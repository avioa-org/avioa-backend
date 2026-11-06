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

type TableLayout = "standard" | "dynamic" | "calendar" | "text";

const SHEET_ID = "1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU";
const CACHE_TTL_MS = 5 * 60 * 1000;

const TABLES: Record<
  string,
  { gid: string; range: string; layout: TableLayout }
> = {
  baja2026:   { gid: "1340216287", range: "A1:AA1038", layout: "standard" },
  alta2026:   { gid: "1746999998", range: "A1:Z1024",  layout: "dynamic"  },
  baja2027:   { gid: "2044920053", range: "A1:AA989",  layout: "standard" },
  navidad:    { gid: "1080181037", range: "A1:AB999",  layout: "text" },
  naio:       { gid: "1730499314", range: "A1:Z999",   layout: "calendar" },
  operadores: { gid: "1744977722", range: "A1:D1014",  layout: "standard" },
};

@Injectable()
export class CommercialDriveTablesService {
  private readonly logger = new Logger(CommercialDriveTablesService.name);
  private cache = new Map<string, { data: TableData; checkedAt: Date }>();

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
          : this.parseByLayout(rows, config.layout);

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

  private parseByLayout(rows: string[][], layout: TableLayout): TableData {
    switch (layout) {
      case "dynamic":  return this.parseDynamic(rows);
      case "calendar": return this.parseCalendar(rows);
      case "text":
      case "standard":
      default:         return this.parseRates(rows);
    }
  }

  private parseTextBlocks(rows: string[][]): TableData {
    // Buscamos la fila que tiene el texto largo (la que tú ves en la captura)
    const contentIdx = rows.findIndex((r) =>
      r.some((c) => (c || "").length > 50),
    );
    
    const idx = contentIdx === -1 ? 1 : contentIdx;
    const contentRow = rows[idx] || [];
    
    const maxWidth = Math.max(0, ...rows.map((r) => r.length));
    const headers: string[] = [];
    const dataCells: string[] = [];

    let blockCount = 1;
    for (let i = 0; i < maxWidth; i++) {
      const val = (contentRow[i] || "").trim();
      
      if (val) {
        // Título genérico para cada columna con contenido
        headers.push(`BLOQUE ${blockCount}`);
        // Reemplazamos los saltos de línea por <br> o espacios para que el front lo entienda
        dataCells.push(val.replace(/\n/g, " ").replace(/\s+/g, " "));
        blockCount++;
      }
    }

    // Metemos todo el texto en una sola fila ficticia para que el frontend lo pinte
    const dataRows: TableRow[] = [];
    if (dataCells.length > 0) {
      dataRows.push({
        id: String(idx + 1),
        cells: dataCells,
      });
    }

    return { headers, rows: dataRows };
  }

  private parseCsv(csv: string): string[][] {
    if (/^\s*</.test(csv)) {
      throw new Error("La hoja no está pública. Revisa los permisos de lectura.");
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

  /**
   * Baja 2026, Baja 2027, Navidad:
   * Ahora lee la fila principal (DESTINO, HOTEL...) y la fila de abajo
   * (TARIFA ADULTO, TARIFA NIÑOS...) para unirlas y no perder columnas.
   */
  private parseRates(rows: string[][]): TableData {
    if (rows.length === 0) return { rows: [], headers: [] };

    const headerIdx = rows.findIndex((r) => {
      const t = r.map((c) => (c || "").toUpperCase()).join(" ");
      return t.includes("DESTINO") || t.includes("HOTEL") || t.includes("FECHA");
    });

    if (headerIdx < 0) return { rows: [], headers: [] };

    const main = rows[headerIdx] || [];
    const sub = rows[headerIdx + 1] || []; // Capturamos la fila de abajo
    const dataStart = headerIdx + 2;       // Los datos empiezan 2 filas abajo
    const maxWidth = Math.max(0, ...rows.map((r) => r.length));

    const clean = (s: string) => s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    const headers: string[] = [];
    for (let i = 0; i < maxWidth; i++) {
      const a = (main[i] || "").trim();
      const b = (sub[i] || "").trim();
      
      let label = "";
      // Si hay título arriba y abajo, los unimos (ej: DOBLE · TARIFA ADULTO)
      if (a && b && !b.includes(a)) label = `${clean(a)} · ${clean(b)}`;
      else label = clean(a || b);

      // Si no hay texto, lo dejamos vacío para que el frontend lo oculte
      headers.push(label ? label.toUpperCase() : "");
    }

    const notes: string[] = [];
    for (let i = 0; i < headerIdx; i++) {
      const line = rows[i].filter(Boolean).join(" · ").trim();
      if (line) notes.push(line);
    }

    const dataRows: TableRow[] = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((c) => c.trim())) continue;
      dataRows.push({
        id: String(i + 1),
        cells: headers.map((_, j) => r[j] || ""),
      });
    }

    return { headers, notes, rows: dataRows };
  }

  private parseDynamic(rows: string[][]): TableData {
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /DESTINO/i.test((c || "").trim())),
    );

    if (headerIdx === -1) return this.parseRates(rows);

    const main = rows[headerIdx] || [];
    const sub = rows[headerIdx + 1] || [];
    const dataStart = headerIdx + 2;
    const maxWidth = Math.max(0, ...rows.map((r) => r.length));

    const clean = (s: string) => s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    const headers: string[] = [];
    for (let i = 0; i < maxWidth; i++) {
      const a = (main[i] || "").trim();
      const b = (sub[i] || "").trim();
      
      let label = "";
      if (a && b && !b.includes(a)) label = `${clean(a)} · ${clean(b)}`;
      else label = clean(a || b);

      headers.push(label ? label.toUpperCase() : "");
    }

    const notes: string[] = [];
    for (let i = 0; i < headerIdx; i++) {
      const line = rows[i].filter(Boolean).join(" · ").trim();
      if (line) notes.push(line);
    }

    const dataRows: TableRow[] = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((c) => c.trim())) continue;
      dataRows.push({
        id: String(i + 1),
        cells: headers.map((_, j) => r[j] || ""),
      });
    }

    return { headers, notes, rows: dataRows };
  }

  private parseCalendar(rows: string[][]): TableData {
    if (rows.length === 0) return { rows: [], headers: [] };

    const maxWidth = Math.max(0, ...rows.map((r) => r.length));
    const headers: string[] = [];

    const firstDayRow = rows[1] || []; 
    const firstDataRow = rows[2] || [];

    for (let i = 0; i < maxWidth; i++) {
        if (i === 0) {
            headers.push("MES"); 
            continue;
        }
        
        const dayLetter = (firstDayRow[i] || "").trim();
        const dayNum = (firstDataRow[i] || "").trim();
        
        if (!dayLetter && !dayNum) {
            headers.push(""); 
        } else {
            headers.push(`${dayLetter} ${dayNum}`.trim().toUpperCase());
        }
    }

    const dataRows: TableRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((c) => c.trim())) continue;
      const cells = headers.map((_, j) => r[j] || "");
      dataRows.push({ id: String(i + 1), cells });
    }

    return { headers, notes: [], rows: dataRows };
  }

  private parseOperators(rows: string[][]): TableData {
    const entries: TableEntry[] = [];

    rows.forEach((r, i) => {
      const cells = r.map((c) => c.trim());
      if (!cells.some(Boolean)) return;
      const [category = "", destination = "", operator = "", raw = ""] = cells;
      if (!raw && !destination && !operator) return;
      entries.push({ id: String(i + 1), category, destination, operator, raw });
    });

    return { entries };
  }
}