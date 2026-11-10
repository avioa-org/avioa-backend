import { CierreEvidence, InterpretedIntent, OfferEvidence } from './types';

const MAX_OFFERS = 10;
const MAX_CHARS = 65_000;
const MAX_CIERRES = 25;

const STOPWORDS_DEST = new Set(['del', 'las', 'los', 'de', 'la', 'el']);

const IGNORED_HOTEL_WORDS = new Set([
  'hotel', 'hoteles', 'grand', 'resort', 'caribe',
]);

/**
 * Normaliza texto: quita tildes, minúsculas, reemplaza signos por espacios.
 */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string, minLen: number): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > minLen);
}

/**
 * Selecciona hasta MAX_OFFERS ofertas relevantes respetando MAX_CHARS.
 *
 * Reglas:
 *  - Todas las palabras del destination deben aparecer en título o cuerpo.
 *  - Score: +12 destino en título, +3 destino en cuerpo, +2 palabra del resumen en título.
 *  - Si destination está vacío, todas pasan y se ordena por score (que será 0).
 */
export function selectOffers(
  offers: OfferEvidence[],
  intent: InterpretedIntent,
): { selected: OfferEvidence[]; omitted: number } {
  const destWords = intent.destination ? tokens(intent.destination, 2).filter((w) => !STOPWORDS_DEST.has(w)) : [];
  const reqWords = tokens(intent.travelRequest ?? '', 3);

  const scored = offers
    .filter((offer) => {
      if (destWords.length === 0) return true;
      const haystack = normalize(`${offer.title} ${offer.text}`);
      return destWords.every((w) => haystack.includes(w));
    })
    .map((offer) => {
      const titleNorm = normalize(offer.title);
      const bodyNorm = normalize(offer.text);
      let score = 0;

      for (const w of destWords) {
        if (titleNorm.includes(w)) score += 12;
        else if (bodyNorm.includes(w)) score += 3;
      }
      for (const w of reqWords) {
        if (titleNorm.includes(w)) score += 2;
      }

      return { offer, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected: OfferEvidence[] = [];
  let chars = 0;

  for (const { offer } of scored) {
    if (selected.length >= MAX_OFFERS) break;
    const len = offer.text.length;
    if (chars + len > MAX_CHARS) continue; // salta y sigue con las demás
    selected.push(offer);
    chars += len;
  }

  return { selected, omitted: offers.length - selected.length };
}

/**
 * Selecciona hasta MAX_CIERRES grupos relevantes.
 *
 * Relevante si:
 *  - Todas las palabras del destino aparecen en el nombre del hotel, O
 *  - Todas las palabras significativas del hotel aparecen en el texto de las ofertas.
 * Si destination está vacío, todos los cierres son "relevantes" y entran los primeros 25.
 */
export function selectCierres(
  cierres: CierreEvidence[],
  intent: InterpretedIntent,
  selectedOffers: OfferEvidence[],
): CierreEvidence[] {
  const destWords = intent.destination ? tokens(intent.destination, 2) : [];

  if (destWords.length === 0) {
    return cierres.slice(0, MAX_CIERRES);
  }

  const offerTextNorm = selectedOffers.map((o) => normalize(o.text)).join(' ');

  const result: CierreEvidence[] = [];

  for (const cierre of cierres) {
    const hotelNorm = normalize(cierre.title);
    const hotelWords = tokens(cierre.title, 3).filter((w) => !IGNORED_HOTEL_WORDS.has(w));

    const condA = destWords.every((w) => hotelNorm.includes(w));
    const condB = hotelWords.length > 0 && hotelWords.every((w) => offerTextNorm.includes(w));

    if (condA || condB) {
      result.push(cierre);
      if (result.length >= MAX_CIERRES) break;
    }
  }

  return result;
}