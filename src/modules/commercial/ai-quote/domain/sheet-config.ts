export const SHEET_SPREADSHEET_ID =
  '1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU';

export interface SheetConfig {
  gid: string;
  tab: 'OFERTAS MED' | 'OFERTAS BOG' | 'OFERTAS CALI' | 'CIERRES';
  range: string;
  origin: 'MED' | 'BOG' | 'CALI' | null;
}

export const SHEETS: SheetConfig[] = [
  { gid: '915260279',  tab: 'OFERTAS MED',  range: 'A1:FY7',   origin: 'MED'  },
  { gid: '1717217639', tab: 'OFERTAS BOG',  range: 'A1:DO7',   origin: 'BOG'  },
  { gid: '1822486735', tab: 'OFERTAS CALI', range: 'A1:AH8',   origin: 'CALI' },
  { gid: '0',          tab: 'CIERRES',      range: 'A1:H1099', origin: null   },
];

export const SHEET_OFFERS = SHEETS.filter((s) => s.origin !== null);
export const SHEET_CIERRES = SHEETS.find((s) => s.tab === 'CIERRES')!;

/**
 * Configuración por hoja: en qué fila está cada campo y desde qué columna empieza.
 * Extraído del comportamiento del proyecto de referencia.
 */
export const OFFER_LAYOUT = {
  MED: {
    firstColumn: 'C',
    rows: {
      title: 0,          // fila 1 (0-indexed)
      updatedAt: 1,      // fila 2
      offer: 3,          // fila 4
      months: 4,         // fila 5
      dates: 5,          // fila 6
      paymentPlan: 6,    // fila 7
      kidsAges: null,
    },
    requireOfferLabelInColumnA: true, // Medellín exige "OFERTA" en col A fila 4
  },
  BOG: {
    firstColumn: 'B',
    rows: {
      title: 0,
      updatedAt: 1,
      offer: 3,
      months: 4,
      dates: 5,
      paymentPlan: 6,
      kidsAges: null,
    },
    requireOfferLabelInColumnA: false,
  },
  CALI: {
    firstColumn: 'B',
    rows: {
      title: 0,
      updatedAt: 1,
      offer: 2,          // Cali tiene OFERTA en fila 3
      months: 3,
      dates: 4,
      paymentPlan: 5,
      kidsAges: 7,       // Cali tiene EDADES NIÑOS en fila 8
    },
    requireOfferLabelInColumnA: false,
  },
} as const;

/**
 * Genera la URL pública de una celda o rango en el sheet.
 */
export function buildSheetUrl(gid: string, range: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_SPREADSHEET_ID}/edit#gid=${gid}&range=${range}`;
}