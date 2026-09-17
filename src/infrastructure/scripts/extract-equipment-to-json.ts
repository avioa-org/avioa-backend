import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_PATH = path.resolve(
  process.cwd(),
  'src/infrastructure/scripts/data/stock.xlsx',
);

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'src/infrastructure/scripts/data/stock-raw.json',
);

function extract() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('No se encontró el Excel en:', EXCEL_PATH);
    process.exit(1);
  }

  const workbook = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];

  console.log(`${rows.length} filas leídas de la hoja "${sheetName}"`);
  console.log(`Columnas detectadas:`, Object.keys(rows[0] || {}));

  // Normalizar cada fila con nombres consistentes
  const normalized = rows.map((row, idx) => ({
    _rowIndex: idx + 2, 
    assetTagId: String(row['Asset Tag ID'] || '').trim(),
    description: String(row['Description'] || '').trim(),
    serialNumber: String(row['Serial No'] || '').trim(),
    location: String(row['Location'] || '').trim(),
    assignedTo: String(row['Assigned to'] || '').trim(),
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2), 'utf-8');

  console.log(`JSON generado en: ${OUTPUT_PATH}`);
  console.log(`Total registros: ${normalized.length}`);
}

extract();