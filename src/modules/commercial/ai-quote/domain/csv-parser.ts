/**
 * Parser CSV manual con soporte de:
 *  - comas, comillas, comillas escapadas ("")
 *  - saltos de línea dentro de celdas
 *  - LF, CR, CRLF
 * Devuelve string[][] (filas x celdas).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        current.push(field);
        field = '';
      } else if (c === '\n') {
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
      } else if (c === '\r') {
        // ignorar; el '\n' siguiente cierra la fila
      } else {
        field += c;
      }
    }
  }

  // Cierre final
  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

/**
 * Convierte letra de columna Excel ("A", "B", ..., "AA") a índice 0-based.
 */
export function columnLetterToIndex(letter: string): number {
  let index = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convierte índice 0-based a letra de columna Excel.
 */
export function indexToColumnLetter(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}