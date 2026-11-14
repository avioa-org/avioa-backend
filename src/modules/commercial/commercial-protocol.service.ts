import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { GoogleSheetClient } from "../flight-blockings/google-sheet.client";

export interface ProtocolStep {
  id: string;
  row: number;
  label: string;
  text: string;
}

export interface ProtocolSection {
  id: string;
  title: string;
  row: number;
  steps: ProtocolStep[];
}

export interface ProtocolResponse {
  sections: ProtocolSection[];
  checkedAt: string;
  warning?: string;
}

const GID = "216144764";
const RANGE = "A1:C1034";
const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CommercialProtocolService {
  private readonly logger = new Logger(CommercialProtocolService.name);
  private cache: {
    sections: ProtocolSection[];
    checkedAt: Date;
  } | null = null;

  constructor(private readonly google: GoogleSheetClient) {}

  async getProtocol(force = false): Promise<ProtocolResponse> {
    const now = Date.now();
    if (
      !force &&
      this.cache &&
      now - this.cache.checkedAt.getTime() < CACHE_TTL_MS
    ) {
      return this.serialize(this.cache.sections, this.cache.checkedAt);
    }

    try {
      // Usamos la lectura autenticada en lugar del fetch
      const rows = await this.google.readAuthenticated(Number(GID), RANGE);
      
      const sections = this.parseProtocol(rows);

      const checkedAt = new Date();
      this.cache = { sections, checkedAt };
      return this.serialize(sections, checkedAt);
    } catch (e: any) {
      const msg = (e as Error).message;
      this.logger.warn(`Protocolo no disponible: ${msg}`);

      if (this.cache) {
        return {
          ...this.serialize(this.cache.sections, this.cache.checkedAt),
          warning: `No se pudo consultar Drive. Se muestran datos en caché de hace ${Math.round(
            (now - this.cache.checkedAt.getTime()) / 60000,
          )} min.`,
        };
      }

      throw new ServiceUnavailableException(
        "El protocolo no está disponible en este momento. Intenta de nuevo más tarde.",
      );
    }
  }

  private serialize(
    sections: ProtocolSection[],
    checkedAt: Date,
  ): ProtocolResponse {
    return { sections, checkedAt: checkedAt.toISOString() };
  }

  /**
   * Adaptado de `parseCommercialProtocol` del módulo original.
   * Mantiene el mismo formato: `{ sections: [{ id, title, row, steps: [{ id, row, label, text }] }] }`
   */
  private parseProtocol(rows: string[][]): ProtocolSection[] {
    const sections: ProtocolSection[] = [];
    let current: ProtocolSection | undefined;
    let objection = "";

    rows.forEach((cells, index) => {
      const values = cells.slice(0, 3).map((v) => (v || "").trim());
      const [a, b, c] = values;

      if (!values.some(Boolean)) return;

      if (/^escenario\s*\d+/i.test(a) || /^manejo de objeciones$/i.test(a)) {
        current = {
          id: String(index + 1),
          title: values.filter(Boolean).join(" · "),
          row: index + 1,
          steps: [],
        };
        sections.push(current);
        objection = "";
        return;
      }

      if (!current) return;

      if (/^manejo de objeciones/i.test(current.title) && a) {
        objection = a;
      }

      const text = c || b || "";
      const label = c
        ? [a || objection, b].filter(Boolean).join(" · ")
        : a || objection;

      current.steps.push({
        id: String(index + 1),
        row: index + 1,
        label,
        text,
      });
    });

    if (!sections.length) {
      throw new Error(
        "No se reconocen los escenarios del protocolo. Revisa la hoja de origen.",
      );
    }

    return sections;
  }
}