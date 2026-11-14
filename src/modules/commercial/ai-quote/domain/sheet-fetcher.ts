import { Logger } from '@nestjs/common';
import { SHEET_SPREADSHEET_ID, SheetConfig } from './sheet-config';
import { SheetFetchResult } from './types';

const logger = new Logger('SheetFetcher');

const TIMEOUT_MS = 25_000;
const MAX_BYTES = 2_000_000;

/**
 * Descarga una hoja de Google Sheets como CSV.
 * Réplica del comportamiento del proyecto de referencia:
 *  - cache: 'no-store'
 *  - timeout 25s
 *  - rechaza si > 2MB
 *  - rechaza si la respuesta empieza con '<' (HTML de login/error)
 */
export async function fetchSheet(sheet: SheetConfig): Promise<SheetFetchResult> {
  const url = buildExportUrl(sheet);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { gid: sheet.gid, tab: sheet.tab, ok: false, error: `HTTP ${response.status}` };
    }

    if (!response.body) {
      return { gid: sheet.gid, tab: sheet.tab, ok: false, error: 'Sin cuerpo de respuesta' };
    }

    // Lectura por streaming con control de tamaño
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let csv = '';
    let bytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          controller.abort();
          return { gid: sheet.gid, tab: sheet.tab, ok: false, error: `Excede ${MAX_BYTES} bytes` };
        }
        csv += decoder.decode(value, { stream: true });
      }
    }
    csv += decoder.decode();

    // Heurística de seguridad: HTML de login/error
    if (csv.trimStart().startsWith('<')) {
      return { gid: sheet.gid, tab: sheet.tab, ok: false, error: 'Respuesta parece HTML (hoja no pública)' };
    }

    return { gid: sheet.gid, tab: sheet.tab, ok: true, csv };
  } catch (err: any) {
    logger.error(`Error descargando ${sheet.tab}: ${err?.message ?? err}`);
    return {
      gid: sheet.gid,
      tab: sheet.tab,
      ok: false,
      error: err?.name === 'AbortError' ? 'Timeout' : String(err?.message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildExportUrl(sheet: SheetConfig): string {
  const params = new URLSearchParams({
    format: 'csv',
    gid: sheet.gid,
    range: sheet.range,
  });
  return `https://docs.google.com/spreadsheets/d/${SHEET_SPREADSHEET_ID}/export?${params.toString()}`;
}