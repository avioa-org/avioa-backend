import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

export interface QuickReplyEntry {
  id: string;
  title: string;
  text: string;
}

export interface QuickRepliesData {
  entries: QuickReplyEntry[];
  checkedAt?: string;
  warning?: string;
}

const SHEET_ID = "1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU";
const GID = "23297697"; // pestaña RESPUESTA RAPIDAS
const RANGE = "A1:B2000";
const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CommercialQuickRepliesService {
  private readonly logger = new Logger(CommercialQuickRepliesService.name);
  private cache?: { data: QuickRepliesData; checkedAt: Date };

  async getReplies(force = false): Promise<QuickRepliesData> {
    const now = Date.now();
    if (
      !force &&
      this.cache &&
      now - this.cache.checkedAt.getTime() < CACHE_TTL_MS
    ) {
      return this.cache.data;
    }

    try {
      const csvUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export`,
      );
      csvUrl.searchParams.set("format", "csv");
      csvUrl.searchParams.set("gid", GID);
      csvUrl.searchParams.set("range", RANGE);

      const response = await fetch(csvUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) throw new Error(`Drive HTTP ${response.status}`);

      const csv = await response.text();
      const entries = this.parseCsv(csv);
      const checkedAt = new Date();
      const data: QuickRepliesData = {
        entries,
        checkedAt: checkedAt.toISOString(),
      };
      this.cache = { data, checkedAt };
      return data;
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`Quick replies Drive falló: ${msg}`);

      if (this.cache) {
        const mins = Math.round(
          (now - this.cache.checkedAt.getTime()) / 60000,
        );
        return {
          ...this.cache.data,
          warning: `No se pudo consultar Drive. Se muestran datos en caché de hace ${mins} min.`,
        };
      }

      throw new ServiceUnavailableException(
        "Las respuestas rápidas no están disponibles en este momento.",
      );
    }
  }

  /**
   * Devuelve [{ id, title, text }] ignorando encabezados y filas vacías.
   * Columna A = título, columna B = respuesta. "id" es el número de fila
   * real (1-based) para armar el link a Drive con &range=A<id>:B<id>.
   */
  private parseCsv(csv: string): QuickReplyEntry[] {
    if (/^\s*</.test(csv)) {
      throw new Error(
        "La hoja no está pública. Revisa los permisos de lectura.",
      );
    }

    const rows = this.splitCsv(csv);
    const entries: QuickReplyEntry[] = [];

    rows.forEach((cells, idx) => {
      const title = (cells[0] ?? "").trim();
      const text = (cells[1] ?? "").trim();
      if (!title && !text) return;
      // Ignora encabezados típicos de la hoja
      if (
        idx === 0 &&
        /^(t[ií]tulo|title|pregunta)$/i.test(title)
      ) {
        return;
      }
      entries.push({ id: String(idx + 1), title, text });
    });

    return entries;
  }

  private splitCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      if (c === '"') {
        if (quoted && csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (c === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && csv[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += c;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
}