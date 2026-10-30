import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

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

const SHEET_ID = "1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU";
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

      if (!response.ok) {
        throw new Error(`Drive HTTP ${response.status}`);
      }

      const csv = await response.text();
      const rows = this.parseCsv(csv);
      const sections = this.parseProtocol(rows);

      const checkedAt = new Date();
      this.cache = { sections, checkedAt };
      return this.serialize(sections, checkedAt);
    } catch (e) {
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

  private parseCsv(csv: string): string[][] {
    if (/^\s*</.test(csv)) {
      throw new Error(
        "La hoja del protocolo no está pública. Revisa los permisos.",
      );
    }

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