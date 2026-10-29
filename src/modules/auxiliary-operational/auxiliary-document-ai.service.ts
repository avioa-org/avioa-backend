import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from 'generated/prisma/enums';
import { z } from 'zod';
import type { ICurrentUser } from '../../common/decorator/current-user.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { envs } from '../../config/env.config';
import {
  auxFields,
  documentDto,
  openAuxFile,
  sealAuxData,
  type AuxAttachment,
  type AuxDocumentRow,
} from './domain/auxiliary';
import { describeAiFailure, type AiStage } from './domain/ai-errors';
import {
  identityBatchInstructions,
  normalizeIdentityBatch,
} from './domain/identity-batch';
import { ExtractAuxiliaryDocumentDto } from './dto/extract-auxiliary-document.dto';
import {
  AuxiliaryOpenAiService,
  type AuxiliaryAiContentPart,
} from './auxiliary-openai.service';

const fieldSchema = z.object({
  names: z.string().max(200),
  surnames: z.string().max(200),
  documentNumber: z.string().max(200),
  birthDate: z.string().max(200),
});

const extractionSchema = z.object({
  passengers: z
    .array(
      z.object({
        fields: fieldSchema,
        passport: z.object({
          documentType: z.enum(['passport', 'idcard', 'unknown']),
          expirationDate: z.string().max(200),
        }),
        warnings: z.array(z.string().max(250)).max(12),
        groupingReason: z.string().max(300),
        sources: z.array(z.number().int().min(1).max(10)).min(1).max(10),
      }),
    )
    .min(1)
    .max(40),
});

const SHARED_AI_QUOTA_LOCK = 74231021;
const MAX_REQUESTS_PER_HOUR = 20;

@Injectable()
export class AuxiliaryDocumentAiService {
  private readonly logger = new Logger(AuxiliaryDocumentAiService.name);
  private readonly model = envs.AUXILIARY_OPENAI_MODEL || 'gpt-4.1';
  private readonly encryptionKey =
    envs.AUXILIARY_ENCRYPTION_KEY || envs.PASSWORD_MASTER_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly openAi: AuxiliaryOpenAiService,
  ) {}

  async extract(
    user: ICurrentUser,
    documentId: string,
    dto: ExtractAuxiliaryDocumentDto,
  ) {
    await this.assertCanWrite(user);
    const requestId = `auxiliary:${dto.requestId}`;
    const row = await this.prisma.operationalDocuments.findFirst({
      where: { id: documentId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('Documento no encontrado.');

    const previous = await this.prisma.operationalAiRuns.findUnique({
      where: { id: requestId },
    });
    if (previous) {
      if (previous.document_id !== documentId || previous.by !== user.email) {
        throw new ConflictException({
          error: 'La consulta corresponde a otros datos.',
        });
      }
      if (previous.status === 'succeeded') {
        return {
          document: await documentDto(
            row as unknown as AuxDocumentRow,
            this.encryptionKey,
          ),
          replayed: true,
        };
      }
      throw new ConflictException({
        error:
          previous.status === 'pending'
            ? 'La lectura está en proceso.'
            : 'Esa lectura no se completó. Pulsa Transcribir para iniciar una nueva.',
      });
    }

    const config = this.getConfig();
    if (!config.enabled) {
      throw new ServiceUnavailableException({
        error:
          'El documento quedó guardado. Gerencia debe activar la conexión de IA para transcribirlo; también puedes completar los datos manualmente.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    let reserved = false;
    let stage: AiStage = 'prepare';
    let inputTokens = 0;
    let outputTokens = 0;
    const diagnosticId = crypto.randomUUID();
    try {
      reserved = await this.reserveRequest(
        requestId,
        documentId,
        user.email,
        config.dailyLimit,
        config.model,
      );
      if (!reserved) {
        throw new HttpException(
          {
            error:
              'Hay una lectura en proceso o se alcanzó el límite compartido de IA.',
          },
          429,
        );
      }

      const attachments = JSON.parse(row.attachments) as AuxAttachment[];
      const content: AuxiliaryAiContentPart[] = [
        {
          type: 'text',
          text: `Identifica todos los pasajeros de esta selección. Puede haber anversos y reversos separados o varias personas. Devuelve una entrada por persona y los números de archivo que la sustentan. Campos: ${Object.values(auxFields).join(', ')}.`,
        },
      ];

      for (const [index, attachment] of attachments.entries()) {
        const encrypted = await this.storage.downloadFile(attachment.key);
        const bytes = await openAuxFile(
          new Uint8Array(encrypted),
          this.encryptionKey,
          attachment.key,
        );
        content.push({
          type: 'text',
          text: `Archivo ${index + 1} (sus páginas pertenecen a esta fuente):`,
        });
        content.push({
          type: 'file',
          data: bytes,
          mediaType: attachment.contentType,
          filename:
            attachment.contentType === 'application/pdf'
              ? 'documento.pdf'
              : `documento-${index + 1}`,
        });
      }

      stage = 'provider';
      const generated = await this.openAi.generateStructured({
        model: config.model,
        instructions: identityBatchInstructions,
        messages: [{ role: 'user', content }],
        schema: extractionSchema,
        schemaName: 'auxiliary_identity_extraction',
        maxOutputTokens: 6000,
        timeoutMs: 75000,
      });
      inputTokens = generated.usage.inputTokens;
      outputTokens = generated.usage.outputTokens;

      stage = 'references';
      const extracted = normalizeIdentityBatch(
        generated.output.passengers,
        attachments.length,
      );
      stage = 'persist';
      const encryptedData = await sealAuxData(
        extracted,
        this.encryptionKey,
        documentId,
      );
      const now = new Date().toISOString();
      const updated = await this.prisma.operationalDocuments.updateMany({
        where: {
          id: documentId,
          revision: row.revision,
          deleted_at: null,
        },
        data: {
          encrypted_data: encryptedData,
          state: 'extracted',
          revision: { increment: 1 },
          updated_by: user.email,
          updated_at: now,
          last_operation: requestId,
        },
      });
      if (!updated.count) {
        throw new ConflictException({
          error: 'Documento actualizado por otra persona.',
        });
      }

      await this.prisma.$transaction([
        this.prisma.operationalAiRuns.update({
          where: { id: requestId },
          data: {
            status: 'succeeded',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            updated_at: now,
          },
        }),
        this.prisma.operationalAudit.create({
          data: {
            id: crypto.randomUUID(),
            entity: 'document',
            target: documentId,
            action: 'extract',
            by: user.email,
            at: now,
          },
        }),
      ]);

      const saved = await this.prisma.operationalDocuments.findFirst({
        where: { id: documentId, deleted_at: null },
      });
      if (!saved) throw new NotFoundException('Documento no encontrado.');

      return {
        document: await documentDto(
          saved as unknown as AuxDocumentRow,
          this.encryptionKey,
        ),
        usage: generated.usage,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        if (reserved) {
          await this.prisma.operationalAiRuns.updateMany({
            where: { id: requestId, status: 'pending' },
            data: {
              status: 'failed',
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              updated_at: new Date().toISOString(),
            },
          });
        }
        throw error;
      }

      const failure = describeAiFailure(error, stage);
      this.logger.error(
        JSON.stringify({
          event: 'auxiliary-ocr-failure',
          diagnosticId,
          requestId: reserved ? requestId : null,
          ...failure.diagnostic,
        }),
      );
      if (reserved) {
        await this.prisma.operationalAiRuns.updateMany({
          where: { id: requestId, status: 'pending' },
          data: {
            status: 'failed',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            updated_at: new Date().toISOString(),
          },
        });
      }
      throw new ServiceUnavailableException({
        error: failure.message,
        code: failure.code,
        diagnosticId,
      });
    }
  }

  private async assertCanWrite(user: ICurrentUser) {
    if (user.role === Role.ADMIN) return;
    const permissions =
      user.modulePermissions.length > 0
        ? user.modulePermissions
        : await this.prisma.modulePermission.findMany({
            where: {
              userId: user.userId,
              module: 'AUXILIARY',
              canAccess: true,
            },
          });
    const canWrite = permissions.some(
      (permission) =>
        permission.module === 'AUXILIARY' &&
        permission.canAccess &&
        (!permission.actions ||
          (Array.isArray(permission.actions) &&
            (permission.actions.length === 0 ||
              permission.actions.some((action) =>
                ['create', 'update', 'delete'].includes(String(action)),
              )))),
    );
    if (!canWrite) {
      throw new ForbiddenException(
        'No tienes permiso para modificar Auxiliares.',
      );
    }
  }

  private getConfig() {
    return {
      model: this.model,
      enabled: envs.AUXILIARY_AI_ENABLED === 'true',
      dailyLimit: Math.max(
        1,
        Math.min(1000, Number(envs.AUXILIARY_AI_DAILY_LIMIT) || 100),
      ),
    };
  }

  private async reserveRequest(
    requestId: string,
    documentId: string,
    email: string,
    dailyLimit: number,
    model: string,
  ) {
    const now = new Date();
    const at = now.toISOString();
    const day = now.toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota',
    });
    const hour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const pendingSince = new Date(now.getTime() - 90 * 1000).toISOString();

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${SHARED_AI_QUOTA_LOCK})`,
      );
      const existing = await transaction.operationalAiRuns.findUnique({
        where: { id: requestId },
      });
      if (existing) return false;

      const [sacDaily, reservationDaily, documentDaily] = await Promise.all([
        transaction.operationalSacAiRuns.count({ where: { day } }),
        transaction.operationalReservationAiRuns.count({ where: { day } }),
        transaction.operationalAiRuns.count({ where: { day } }),
      ]);
      const [sacHourly, reservationHourly, documentHourly] = await Promise.all([
        transaction.operationalSacAiRuns.count({
          where: { by: email, created_at: { gte: hour } },
        }),
        transaction.operationalReservationAiRuns.count({
          where: { by: email, created_at: { gte: hour } },
        }),
        transaction.operationalAiRuns.count({
          where: { by: email, created_at: { gte: hour } },
        }),
      ]);
      const pending = await transaction.operationalAiRuns.count({
        where: {
          document_id: documentId,
          status: 'pending',
          created_at: { gte: pendingSince },
        },
      });
      if (
        sacDaily + reservationDaily + documentDaily >= dailyLimit ||
        sacHourly + reservationHourly + documentHourly >=
          MAX_REQUESTS_PER_HOUR ||
        pending > 0
      ) {
        return false;
      }

      await transaction.operationalAiRuns.create({
        data: {
          id: requestId,
          document_id: documentId,
          by: email,
          day,
          status: 'pending',
          model,
          created_at: at,
          updated_at: at,
        },
      });
      return true;
    });
  }
}
