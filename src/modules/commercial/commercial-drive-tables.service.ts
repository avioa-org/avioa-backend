import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

export interface TableRow {
  id: string;
  cells: string[];
}

export interface TableEntry {
  id: string;
  destination: string;
  operator: string;
  raw: string;
  category: string;
}

export interface TableData {
  headers?: string[];
  notes?: string[];
  rows?: TableRow[];
  entries?: TableEntry[];
  checkedAt?: string;
  warning?: string;
}

const SHEET_ID = "1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU";
const CACHE_TTL_MS = 5 * 60 * 1000;

const TABLES: Record<string, { gid: string; range: string }> = {
  baja2026: { gid: "1340216287", range: "A1:Z300" },
  alta2026: { gid: "1746999998", range: "A1:Z300" },
  baja2027: { gid: "2044920053", range: "A1:Z300" },
  navidad: { gid: "1080181037", range: "A1:Z300" },
  naio: { gid: "1730499314", range: "A1:Z300" },
  operadores: { gid: "1744977722", range: "A1:F300" },
};

@Injectable()
export class CommercialDriveTablesService {
  private readonly logger = new Logger(CommercialDriveTablesService.name);
  private cache = new Map<
    string,
    { data: TableData; checkedAt: Date }
  >();

  async getTable(source: string, force = false): Promise<TableData> {
    if (!TABLES[source]) {
      throw new BadRequestException(`Fuente desconocida: ${source}`);
    }

    const now = Date.now();
    const cached = this.cache.get(source);
    if (!force && cached && now - cached.checkedAt.getTime() < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const config = TABLES[source];
      const csvUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export`,
      );
      csvUrl.searchParams.set("format", "csv");
      csvUrl.searchParams.set("gid", config.gid);
      csvUrl.searchParams.set("range", config.range);

      const response = await fetch(csvUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) throw new Error(`Drive HTTP ${response.status}`);

      const csv = await response.text();
      const rows = this.parseCsv(csv);

      const data =
        source === "operadores"
          ? this.parseOperators(rows)
          : this.parseRates(rows);

      const checkedAt = new Date();
      data.checkedAt = checkedAt.toISOString();
      this.cache.set(source, { data, checkedAt });
      return data;
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`Drive tables ${source} falló: ${msg}`);

      if (cached) {
        return {
          ...cached.data,
          warning: `No se pudo consultar Drive. Se muestran datos en caché de hace ${Math.round(
            (now - cached.checkedAt.getTime()) / 60000,
          )} min.`,
        };
      }

      throw new ServiceUnavailableException(
        `La tabla "${source}" no está disponible en este momento.`,
      );
    }
  }

  /* ─────────────────────────────────────────────
     Parser CSV
     ───────────────────────────────────────────── */
  private parseCsv(csv: string): string[][] {
    if (/^\s*</.test(csv)) {
      throw new Error(
        "La hoja no está pública. Revisa los permisos de lectura.",
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
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && csv[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  /* ─────────────────────────────────────────────
     Parse tarifas (tabla con headers)
     ───────────────────────────────────────────── */
  private parseRates(rows: string[][]): TableData {
    if (rows.length === 0) return { rows: [], headers: [] };

    // Los primeros 2-3 renglones pueden ser notas
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => c.trim() !== ""),
    );

    if (headerIdx < 0) return { rows: [], headers: [] };

    const headers = rows[headerIdx].map((c) => c.trim() || "—");
    const notes: string[] = [];
    for (let i = 0; i < headerIdx; i++) {
      const line = rows[i].filter(Boolean).join(" · ").trim();
      if (line) notes.push(line);
    }

    const dataRows: TableRow[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((c) => c.trim())) continue;
      dataRows.push({
        id: String(i + 1),
        cells: headers.map((_, j) => r[j] || ""),
      });
    }

    return { headers, notes, rows: dataRows };
  }

  /* ─────────────────────────────────────────────
     Parse operadores (cards con links)
     ───────────────────────────────────────────── */
  private parseOperators(rows: string[][]): TableData {
    const entries: TableEntry[] = [];

    rows.forEach((r, i) => {
      const cells = r.map((c) => c.trim());
      if (!cells.some(Boolean)) return;

      // Convención: categoría | destino | operador | link
      const [category = "", destination = "", operator = "", raw = ""] =
        cells;

      if (!raw && !destination && !operator) return;

      entries.push({
        id: String(i + 1),
        category,
        destination,
        operator,
        raw,
      });
    });

    return { entries };
  }
}