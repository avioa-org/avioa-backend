import { Logger } from '@nestjs/common';
import { parseCsv, indexToColumnLetter } from './csv-parser';
import { buildSheetUrl } from './sheet-config';
import { CierreEvidence } from './types';

const logger = new Logger('CierresParser');

/**
 * Convierte el CSV de CIERRES en un array de CierreEvidence.
 *
 * Reglas del proyecto de referencia:
 *  - Columna B = nombre del hotel.
 *  - Cada B no vacía (distinta de HOTEL) inicia un grupo.
 *  - Filas siguientes con B vacía pertenecen al último hotel.
 *  - Guarda contenido de C:H concatenado con " | ".
 *  - Conserva número de fila y enlace al rango.
 */
export function parseCierres(csv: string, gid: string): CierreEvidence[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];

  const cierres: CierreEvidence[] = [];

  let currentHotel: string | null = null;
  let currentRows: string[] = [];
  let currentStartRow = 0;

  const flush = () => {
    if (!currentHotel || currentRows.length === 0) return;

    const range = `B${currentStartRow}:H${currentStartRow + currentRows.length - 1}`;

    cierres.push({
      id: `cierre:${currentStartRow}`,
      kind: 'cierre',
      title: currentHotel,
      tab: 'CIERRES',
      range,
      text: currentRows.map((r, i) => `Fila ${currentStartRow + i}: ${r}`).join('\n'),
    });
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    const colB = (row[1] ?? '').trim();

    // Detectar nuevo hotel
    if (colB && colB.toUpperCase() !== 'HOTEL') {
      flush();
      currentHotel = colB;
      currentRows = [];
      currentStartRow = rowNumber;
    }

    if (currentHotel) {
      // Concatenar C:H
      const cols = row.slice(2, 8).map((c) => (c ?? '').trim());
      const joined = cols.filter((c) => c !== '').join(' | ');
      if (joined !== '') {
        currentRows.push(joined);
      }
    }
  }

  flush();

  logger.debug(`CIERRES: ${cierres.length} grupos parseados`);
  return cierres;
}