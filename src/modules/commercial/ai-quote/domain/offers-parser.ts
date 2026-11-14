import { Logger } from '@nestjs/common';
import { parseCsv, columnLetterToIndex, indexToColumnLetter } from './csv-parser';
import {
  OFFER_LAYOUT,
  buildSheetUrl,
} from './sheet-config';
import { OfferEvidence } from './types';

const logger = new Logger('OffersParser');

type Origin = 'MED' | 'BOG' | 'CALI';

/**
 * Convierte el CSV de una hoja OFERTAS_* en un array de OfferEvidence.
 *
 * Réplica de las reglas del proyecto de referencia:
 *  - Cada columna (desde firstColumn) es una oferta candidata.
 *  - Requiere: título no vacío en fila 1, contenido no vacío en fila de OFERTA,
 *    y que ese contenido incluya alguna palabra clave (incluye|vuelos|tiquetes|alojamiento|hotel).
 *  - En MED, además exige "OFERTA" en col A fila 4.
 */
export function parseOffers(
  csv: string,
  origin: Origin,
  gid: string,
  tab: 'OFERTAS MED' | 'OFERTAS BOG' | 'OFERTAS CALI',
): OfferEvidence[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];

  const layout = OFFER_LAYOUT[origin];
  const startCol = columnLetterToIndex(layout.firstColumn);

  const firstRow = rows[0] ?? [];
  const maxCols = Math.max(...rows.map((r) => r.length));

  const offers: OfferEvidence[] = [];

  for (let col = startCol; col < maxCols; col++) {
    const colLetter = indexToColumnLetter(col);

    // Regla específica MED: exigir "OFERTA" en A{offerRow+1}
    if (layout.requireOfferLabelInColumnA) {
      const colAValue = (rows[layout.rows.offer]?.[0] ?? '').trim().toUpperCase();
      if (!colAValue.includes('OFERTA')) {
        logger.debug(`MED: col A no contiene "OFERTA", se omite columna ${colLetter}`);
        // Nota: en el comportamiento original esta validación se hace una sola vez,
        // pero el efecto práctico es que si falla, no se acepta ninguna columna.
        return [];
      }
    }

    const title = safeCell(rows, layout.rows.title, col);
    const updatedAt = safeCell(rows, layout.rows.updatedAt, col);
    const offerText = safeCell(rows, layout.rows.offer, col);

    // Regla 1 y 2: título y oferta no vacíos
    if (!title || !offerText) continue;

    // Regla 3: contiene palabras clave
    const haystack = offerText.toLowerCase();
    const keywordMatch = /incluye|vuelos|tiquetes|alojamiento|hotel/.test(haystack);
    if (!keywordMatch) continue;

    // Construir texto formateado
    const months = safeCell(rows, layout.rows.months, col);
    const dates = safeCell(rows, layout.rows.dates, col);
    const paymentPlan = safeCell(rows, layout.rows.paymentPlan, col);
    const kidsAges = layout.rows.kidsAges !== null
      ? safeCell(rows, layout.rows.kidsAges, col)
      : '';

    const lines: string[] = [];
    if (updatedAt) lines.push(`Actualización indicada: ${updatedAt}`);
    lines.push(`OFERTA: ${offerText}`);
    if (months) lines.push(`MESES DISPONIBLES: ${months}`);
    if (dates) lines.push(`FECHAS: ${dates}`);
    if (paymentPlan) lines.push(`PLAN SEPARE: ${paymentPlan}`);
    if (kidsAges) lines.push(`EDADES NIÑOS: ${kidsAges}`);

    const maxRow = layout.rows.paymentPlan + 1;
    const range = `${colLetter}1:${colLetter}${maxRow}`;

    offers.push({
      id: `${origin.toLowerCase()}:${colLetter}`,
      kind: 'oferta',
      title,
      tab,
      range,
      url: buildSheetUrl(gid, range),
      text: lines.join('\n'),
    });
  }

  logger.debug(`${tab}: ${offers.length} ofertas parseadas`);
  return offers;
}

function safeCell(rows: string[][], rowIdx: number, colIdx: number): string {
  const row = rows[rowIdx];
  if (!row) return '';
  return (row[colIdx] ?? '').trim();
}