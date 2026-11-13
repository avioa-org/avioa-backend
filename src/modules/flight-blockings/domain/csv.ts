export function parseOffersCsv(text: string): string[][] {
  if (/^\s*</.test(text))
    throw Error(
      'El tarifario no está disponible como hoja pública. Revisa el permiso de lectura del enlace.',
    );
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted)
    throw Error('El archivo recibido está incompleto. Intenta actualizar.');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
