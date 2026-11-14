import { Logger } from '@nestjs/common';
import { GoogleSheetClient } from '../../../flight-blockings/google-sheet.client';
import { SheetConfig } from './sheet-config';
import { SheetFetchResult } from './types';

const logger = new Logger('SheetFetcher');

/**
 * Lee una hoja de Google Sheets con la cuenta de servicio.
 */
export async function fetchSheet(
  sheet: SheetConfig,
  googleSheet: GoogleSheetClient,
): Promise<SheetFetchResult> {
  try {
    const sheetId = Number(sheet.gid);
    if (!Number.isInteger(sheetId)) {
      throw new Error(`GID inválido para la pestaña ${sheet.tab}: ${sheet.gid}`);
    }
    const rows = await googleSheet.readAuthenticated(sheetId, sheet.range);
    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    return { gid: sheet.gid, tab: sheet.tab, ok: true, csv };
  } catch (err: any) {
    logger.error(`Error descargando ${sheet.tab}: ${err?.message ?? err}`);
    return {
      gid: sheet.gid,
      tab: sheet.tab,
      ok: false,
      error: String(err?.message ?? err),
    };
  }
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}