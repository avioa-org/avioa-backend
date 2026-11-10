import { Injectable, Logger, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { envs } from 'src/config/env.config';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

import { SHEET_OFFERS, SHEET_CIERRES } from '../domain/sheet-config';
import { fetchSheet } from '../domain/sheet-fetcher';
import { parseOffers } from '../domain/offers-parser';
import { parseCierres } from '../domain/cierres-parser';
import { selectOffers, selectCierres } from '../domain/offers-selector';
import { interpretIntent } from '../domain/intent-interpreter';
import { buildQuote } from '../domain/quote-builder';
import { validateQuote } from '../domain/quote-validator';
import {
  CierreEvidence,
  InterpretedIntent,
  OfferEvidence,
  QuoteAnswer,
  SheetFetchResult,
} from '../domain/types';

@Injectable()
export class AiQuoteService {
  private readonly logger = new Logger(AiQuoteService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI({ apiKey: envs.OPENAI_API_KEY });
    this.model = envs.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  /**
   * Flujo principal del cotizador.
   */
  async quote(
    userId: string,
    requestId: string | undefined,
    threadId: string | undefined,
    message: string,
  ) {
    const started = Date.now();
    const realRequestId = requestId?.trim() || randomUUID();

    // 1. Idempotencia
    const existing = await this.prisma.commercialQuoteRun.findUnique({
      where: { requestId: realRequestId },
    });

    if (existing && existing.status === 'COMPLETED') {
      return {
        requestId: realRequestId,
        cached: true,
        ...(existing.answer as any),
        intent: existing.intent,
        sources: existing.sources,
      };
    }

    // 2. Crear registro
    const run = existing ?? await this.prisma.commercialQuoteRun.create({
      data: {
        requestId: realRequestId,
        threadId: threadId ?? null,
        userId,
        message,
        status: 'PENDING',
        model: this.model,
      },
    });

    let accumulatedInput = 0;
    let accumulatedOutput = 0;

    try {
      // 3. Interpretar solicitud
      const { intent, inputTokens: i1, outputTokens: o1 } = await interpretIntent(
        this.openai,
        this.model,
        message,
      );
      accumulatedInput += i1;
      accumulatedOutput += o1;

      // Si no hay solicitud comercial clara → responder pregunta breve
      if (intent.destination === null) {
        const answer: QuoteAnswer = {
          answer: intent.question || '¿Qué destino o producto necesitas cotizar?',
          missingData: [],
          options: [],
        };

        await this.finalizeRun(run.id, 'COMPLETED', answer, intent, [], accumulatedInput, accumulatedOutput, started);
        return { requestId: realRequestId, cached: false, ...answer, intent };
      }

      // 4. Descargar hojas según origin
      const sheetsToFetch = intent.origin
        ? SHEET_OFFERS.filter((s) => s.origin === intent.origin)
        : SHEET_OFFERS;

      const fetchPromises = [
        ...sheetsToFetch.map((s) => fetchSheet(s)),
        fetchSheet(SHEET_CIERRES),
      ];

      const fetchResults: SheetFetchResult[] = await Promise.all(fetchPromises);

      const offers: OfferEvidence[] = [];
      let cierres: CierreEvidence[] = [];
      const sources: Array<{ tab: string; ok: boolean; error?: string }> = [];

      for (const result of fetchResults) {
        sources.push({ tab: result.tab, ok: result.ok, error: result.error });

        if (!result.ok || !result.csv) continue;

        if (result.tab === 'CIERRES') {
          cierres = parseCierres(result.csv, result.gid);
        } else {
          const origin = result.tab === 'OFERTAS MED' ? 'MED'
            : result.tab === 'OFERTAS BOG' ? 'BOG'
            : 'CALI';
          const parsed = parseOffers(
            result.csv,
            origin,
            result.gid,
            result.tab as 'OFERTAS MED' | 'OFERTAS BOG' | 'OFERTAS CALI',
          );
          offers.push(...parsed);
        }
      }

      if (offers.length === 0) {
        const answer: QuoteAnswer = {
          answer: 'No pude consultar el tarifario en este momento. Intenta de nuevo en unos minutos.',
          missingData: [],
          options: [],
        };
        await this.finalizeRun(run.id, 'COMPLETED', answer, intent, sources, accumulatedInput, accumulatedOutput, started);
        return { requestId: realRequestId, cached: false, ...answer, intent, sources };
      }

      // 5. Seleccionar ofertas y cierres
      const { selected: selectedOffers, omitted } = selectOffers(offers, intent);
      const selectedCierres = selectCierres(cierres, intent, selectedOffers);

      // 6. Segunda llamada: cotización estructurada
      const { answer: rawAnswer, inputTokens: i2, outputTokens: o2 } = await buildQuote(
        this.openai,
        this.model,
        message,
        intent,
        selectedOffers,
        selectedCierres,
        omitted,
      );
      accumulatedInput += i2;
      accumulatedOutput += o2;

      // 7. Validar
      const validated = validateQuote(rawAnswer, {
        offers: selectedOffers,
        cierres: selectedCierres,
      });

      await this.finalizeRun(run.id, 'COMPLETED', validated, intent, sources, accumulatedInput, accumulatedOutput, started);

      return {
        requestId: realRequestId,
        cached: false,
        ...validated,
        intent,
        sources,
        omitted,
      };
    } catch (err: any) {
      this.logger.error(`Error en cotización: ${err?.message ?? err}`, err?.stack);
      await this.prisma.commercialQuoteRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: String(err?.message ?? err),
          inputTokens: accumulatedInput,
          outputTokens: accumulatedOutput,
          durationMs: Date.now() - started,
        },
      });
      throw new InternalServerErrorException(
        'Error procesando la cotización. Intenta nuevamente.',
      );
    }
  }

  private async finalizeRun(
    id: string,
    status: 'COMPLETED' | 'FAILED',
    answer: QuoteAnswer,
    intent: InterpretedIntent,
    sources: any,
    inputTokens: number,
    outputTokens: number,
    startedAt: number,
  ) {
    await this.prisma.commercialQuoteRun.update({
      where: { id },
      data: {
        status,
        answer: answer as any,
        intent: intent as any,
        sources: sources as any,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      },
    });
  }
}