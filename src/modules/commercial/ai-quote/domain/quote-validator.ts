import { Logger } from '@nestjs/common';
import {
  CierreEvidence,
  OfferEvidence,
  QuoteAnswer,
  QuoteOption,
  QuoteHotel,
} from './types';

const logger = new Logger('QuoteValidator');

interface ValidationSources {
  offers: OfferEvidence[];
  cierres: CierreEvidence[];
}

/**
 * Valida la respuesta estructurada del LLM.
 *
 * Reglas:
 *  - Todas las referencias (sourceIds) deben existir.
 *  - Al menos una debe ser de tipo oferta (no solo cierres).
 *  - Cada hotel debe citar un sourceId de oferta incluido en la opción.
 *  - El nombre del hotel debe aparecer literalmente dentro del excerpt.
 *  - Si rateText no está vacío, debe aparecer literalmente dentro del excerpt.
 *  - priceCOP: si no es null, el excerpt de precio debe contener ese número.
 *    Si falla, se pone null y priceExcerpt vacío.
 *
 * Si un hotel falla, se elimina la opción completa (regla estricta del proyecto de referencia).
 */
export function validateQuote(
  answer: QuoteAnswer,
  sources: ValidationSources,
): QuoteAnswer {
  const offerById = new Map(sources.offers.map((o) => [o.id, o]));
  const cierreById = new Map(sources.cierres.map((c) => [c.id, c]));

  const validOptions: QuoteOption[] = [];

  for (const option of answer.options) {
    const validated = validateOption(option, offerById, cierreById);
    if (validated) validOptions.push(validated);
  }

  return {
    ...answer,
    options: validOptions,
  };
}

function validateOption(
  option: QuoteOption,
  offers: Map<string, OfferEvidence>,
  cierres: Map<string, CierreEvidence>,
): QuoteOption | null {
  if (!Array.isArray(option.sourceIds) || option.sourceIds.length === 0) {
    logger.warn(`Opción "${option.title}" sin sourceIds, se descarta`);
    return null;
  }

  const allExist = option.sourceIds.every((id) => offers.has(id) || cierres.has(id));
  if (!allExist) {
    logger.warn(`Opción "${option.title}" tiene sourceIds inexistentes, se descarta`);
    return null;
  }

  const hasOffer = option.sourceIds.some((id) => offers.has(id));
  if (!hasOffer) {
    logger.warn(`Opción "${option.title}" no referencia ninguna oferta, se descarta`);
    return null;
  }

  const hotels = Array.isArray(option.hotels) ? option.hotels : [];
  const validHotels: QuoteHotel[] = []; ;

  for (const hotel of hotels) {
    if (!hotel.sourceId || !offers.has(hotel.sourceId)) {
      logger.warn(`Hotel "${hotel.name}" referencia sourceId inválido`);
      return null;
    }

    const sourceOffer = offers.get(hotel.sourceId)!;
    const sourceText = sourceOffer.text;
    const excerpt = String(hotel.excerpt ?? '');
    const rateText = String(hotel.rateText ?? '');

    // El nombre debe aparecer literal en el excerpt
    if (hotel.name && !excerpt.includes(hotel.name)) {
      // Fallback: al menos debe aparecer en el texto completo de la fuente
      if (!sourceText.includes(hotel.name)) {
        logger.warn(`Hotel "${hotel.name}" no aparece en su fuente, opción descartada`);
        return null;
      }
    }

    // rateText literal en excerpt (si no está vacío)
    if (rateText && !excerpt.includes(rateText)) {
      if (!sourceText.includes(rateText)) {
        logger.warn(`rateText "${rateText}" no aparece en la fuente del hotel "${hotel.name}"`);
        return null;
      }
    }

    validHotels.push(hotel);
  }

  // Validar priceCOP
  let priceCOP = option.priceCOP ?? null;
  let priceExcerpt = option.priceExcerpt ?? '';
  let priceSourceId = option.priceSourceId ?? '';

  if (priceCOP !== null) {
    const source = priceSourceId ? offers.get(priceSourceId) : null;
    if (!source || !priceExcerpt) {
      priceCOP = null;
      priceExcerpt = '';
      priceSourceId = '';
    } else {
      const digitsInExcerpt = priceExcerpt.replace(/[^\d]/g, '');
      const digitsInPrice = String(priceCOP).replace(/[^\d]/g, '');
      if (!digitsInExcerpt.includes(digitsInPrice)) {
        logger.warn(`priceCOP ${priceCOP} no coincide con excerpt, se anula`);
        priceCOP = null;
        priceExcerpt = '';
        priceSourceId = '';
      }
    }
  }

  return {
    ...option,
    hotels: validHotels,
    priceCOP,
    priceExcerpt,
    priceSourceId,
  };
}