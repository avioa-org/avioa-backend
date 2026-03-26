import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { envs } from 'src/config/env.config';

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets: sheets_v4.Sheets;
  private readonly spreadsheetId =
    '1YdRLlGazCACsxHgPlhh6ltL3Zc18kbC_Hh6Pv56SvyQ';
  private readonly sheetName = 'Hoja 1';

  // Indice en memoria: threadId -> número de fila (1-indexed sin encabezado)
  private rowIndex: Map<string, number> = new Map();

  async onModuleInit() {
    const credentials = JSON.parse(envs.googleCredentials);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    await this.cargarIndice();
  }

  public async cargarIndice() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:A`,
    });
    const rows = res.data.values ?? [];
    this.rowIndex.clear();

    // Fila 1 = encabezado, datos desde fila 2
    rows.slice(1).forEach((row, i) => {
      if (row[0]) this.rowIndex.set(row[0], i + 2);
    });
    this.logger.log(`Índice Sheet cargado: ${this.rowIndex.size} filas`);
  }

  public getRowIndex() {
    return this.rowIndex;
  }

  // Agregar filas nuevas en batch
  async appendRows(rows: any[][]) {
    if (rows.length === 0) return;
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    // Recarga el índice después de agregar
    await this.cargarIndice();
    this.logger.log(`Sheet: ${rows.length} filas nuevas agregadas`);
  }

  // Actualiza celdas individuales usando batchUpdate
  async updateCells(updates: { row: number; col: number; value: any }[]) {
    if (updates.length === 0) return;

    // Agrupar por fila para minimizar llamadas
    const porFila = new Map<number, Map<number, any>>();
    updates.forEach(({ row, col, value }) => {
      if (!porFila.has(row)) porFila.set(row, new Map());
      porFila.get(row)!.set(col, value ?? '');
    });

    const data: sheets_v4.Schema$ValueRange[] = [];
    porFila.forEach((cols, row) => {
      cols.forEach((value, col) => {
        // Convierte número de columna a letra (1=A, 2=B, ...)
        const colLetter = this.colToLetter(col);
        data.push({
          range: `${this.sheetName}!${colLetter}${row}`,
          values: [[value instanceof Date ? value.toISOString() : value]],
        });
      });
    });

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
    this.logger.log(`Sheet: ${porFila.size} filas actualizadas`);
  }

  private colToLetter(col: number): string {
    let letter = '';
    while (col > 0) {
      const rem = (col - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  }
}
