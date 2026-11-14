import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { GoogleSheetClient } from "../flight-blockings/google-sheet.client";

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

const GID = "23297697"; // pestaña RESPUESTA RAPIDAS
const RANGE = "A1:B2000";
const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CommercialQuickRepliesService {
  private readonly logger = new Logger(CommercialQuickRepliesService.name);
  private cache?: { data: QuickRepliesData; checkedAt: Date };

  constructor(private readonly google: GoogleSheetClient) {}

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
      // Usamos el cliente autenticado en lugar del fetch público
      const rows = await this.google.readAuthenticated(Number(GID), RANGE);

      const entries = this.parseRows(rows);
      const checkedAt = new Date();
      const data: QuickRepliesData = {
        entries,
        checkedAt: checkedAt.toISOString(),
      };
      this.cache = { data, checkedAt };
      return data;
    } catch (e: any) {
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
  private parseRows(rows: string[][]): QuickReplyEntry[] {
    const entries: QuickReplyEntry[] = [];

    rows.forEach((cells, idx) => {
      const title = (cells[0] ?? "").trim();
      const text = (cells[1] ?? "").trim();
      
      if (!title && !text) return;
      
      // Ignora encabezados típicos de la hoja
      if (idx === 0 && /^(t[ií]tulo|title|pregunta)$/i.test(title)) {
        return;
      }
      
      entries.push({ id: String(idx + 1), title, text });
    });

    return entries;
  }
}