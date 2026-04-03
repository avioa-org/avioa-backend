import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { envs } from 'src/config/env.config';

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name);
  private sheets: sheets_v4.Sheets;

  async onModuleInit() {
    const credentials = JSON.parse(envs.googleCredentials);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    // await this.cargarIndice();
  }

  public async cargarIndice(
    spreadsheetId: string,
    sheetName = 'Hoja 1',
    keyColumn = 'A',
  ): Promise<Map<string, number>> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${keyColumn}:${keyColumn}`,
    });

    const rows = res.data.values ?? [];
    const index = new Map<string, number>();
    rows.slice(1).forEach((row, i) => {
      if (row[0]) index.set(row[0], i + 2);
    });
    return index;
  }

  public async cargarColumna(
    spreadsheetId: string,
    sheetName = 'Hoja 1',
    column = 'A',
  ): Promise<Set<string>> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${column}:${column}`,
    });
    const rows = res.data.values ?? [];
    return new Set(
      rows
        .slice(1)
        .map((r) => r[0])
        .filter(Boolean),
    );
  }

  // public getRowIndex() {
  //   return this.rowIndex;
  // }

  // Agregar filas nuevas en batch
  async appendRows(
    spreadsheetId: string,
    rows: any[][],
    sheetName = 'Hoja 1',
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    this.logger.log(`Sheet ${spreadsheetId}: ${rows.length} filas agregadas`);
  }

  // Actualiza celdas individuales usando batchUpdate
  async updateCells(
    spreadsheetId: string,
    updates: { row: number; col: number; value: any }[],
    sheetName = 'Hoja 1',
  ): Promise<void> {
    if (updates.length === 0) return;

    const data: sheets_v4.Schema$ValueRange[] = updates.map(
      ({ row, col, value }) => ({}),
    );
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
