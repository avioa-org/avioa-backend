// ─────────────────────────────────────────────────────
// Tipos compartidos del módulo ai-quote
// ─────────────────────────────────────────────────────

export type Origin = 'MED' | 'BOG' | 'CALI' | null;

/**
 * Lo que devuelve la primera llamada a OpenAI: interpretación de la solicitud.
 */
export interface InterpretedIntent {
  origin: Origin;
  destination: string | null;
  travelRequest: string;
  question: string;
}

/**
 * Oferta parseada de una columna del sheet.
 */
export interface OfferEvidence {
  id: string;         
  kind: 'oferta';
  title: string;       
  tab: 'OFERTAS MED' | 'OFERTAS BOG' | 'OFERTAS CALI';
  range: string;       // ej: "D1:D7"
  url: string;         // enlace a Google Sheets
  text: string;        // texto formateado con OFERTA, MESES, FECHAS, PLAN SEPARE
}

/**
 * Cierre parseado del bloque de CIERRES.
 */
export interface CierreEvidence {
  id: string;          // "cierre:37"
  kind: 'cierre';
  title: string;       // nombre del hotel
  tab: 'CIERRES';
  range: string;       // "B37:H42"
  text: string;        // filas concatenadas
}

/**
 * Resultado de descargar una hoja.
 */
export interface SheetFetchResult {
  gid: string;
  tab: string;
  ok: boolean;
  csv?: string;
  error?: string;
}

/**
 * Objeto final que devuelve la segunda llamada a OpenAI (structured output).
 */
export interface QuoteAnswer {
  answer: string;
  missingData: string[];
  options: QuoteOption[];
}

export interface QuoteOption {
  title: string;
  detail: string;
  presentation: {
    duration: string;
    origin: string;
    accommodation: string;
    dates: string[];
    includes: string[];
    excludes: string[];
    paymentTerms: string[];
    conditions: string[];
  };
  hotels: QuoteHotel[];
  priceCOP: number | null;
  priceExcerpt: string;
  priceSourceId: string;
  sourceIds: string[];
  closureNote: string;
  closureStatus: 'possible_conflict' | 'not_verified';
}

export interface QuoteHotel {
  name: string;
  rateText: string;
  excerpt: string;
  sourceId: string;
  closureNote: string;
}