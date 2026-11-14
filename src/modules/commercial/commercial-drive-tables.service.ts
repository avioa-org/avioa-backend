import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { GoogleSheetClient } from "../flight-blockings/google-sheet.client";

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

  constructor(private readonly google: GoogleSheetClient) {}

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
      
      const rows = await this.google.readAuthenticated(
        Number(config.gid), 
        config.range
      );

      const data =
        source === "operadores"
          ? this.parseOperators(rows)
          : this.parseByLayout(rows, config.layout);

      const checkedAt = new Date();
      data.checkedAt = checkedAt.toISOString();
      this.cache.set(source, { data, checkedAt });
      return data;
    } catch (e: any) {
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
      case "dynamic":  return this.parseTable(rows);
      case "calendar": return this.parseCalendar(rows);
      case "text":
      case "standard":
      default:         return this.parseTable(rows);
    }
  }

  // 🔥 NUEVO PARSER GENÉRICO (Funciona para Baja, Alta, Navidad, etc.)
  private parseTable(rows: string[][]): TableData {
    if (rows.length === 0) return { rows: [], headers: [] };

    // Buscamos la primera fila que tenga al menos 3 celdas no vacías.
    // Esa será nuestra cabecera.
    const headerIdx = rows.findIndex((r) => r.filter((c) => c && c.trim() !== "").length >= 3);

    // Si no encontramos una cabecera clara, usamos la fila 0 o 1.
    const idx = headerIdx === -1 ? (rows[0]?.length > 0 ? 0 : 1) : headerIdx;

    const main = rows[idx] || [];
    const sub = rows[idx + 1] || [];
    const dataStart = idx + 1; 
    const maxWidth = Math.max(0, ...rows.map((r) => r.length));

    const clean = (s: string) => (s || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    const headers: string[] = [];
    for (let i = 0; i < maxWidth; i++) {
      const a = clean(main[i]);
      const b = clean(sub[i]);
      
      // Si ambas filas tienen texto distinto, las unimos
      let label = "";
      if (a && b && !b.includes(a) && a !== b) label = `${a} · ${b}`;
      else label = a || b;

      headers.push(label ? label.toUpperCase() : `COL ${i + 1}`);
    }

    const notes: string[] = [];
    for (let i = 0; i < idx; i++) {
      const line = (rows[i] || []).filter(Boolean).join(" · ").trim();
      if (line) notes.push(line);
    }

    const dataRows: TableRow[] = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((c) => c && c.trim())) continue; // Ignorar filas vacías
      dataRows.push({
        id: String(i + 1),
        cells: headers.map((_, j) => r[j] || ""),
      });
    }

    return { headers, notes, rows: dataRows };
  }

  // El parser de calendario (Naio) que ya funcionaba
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
      const cells = r.map((c) => (c || "").trim());
      if (!cells.some(Boolean)) return;
      const [category = "", destination = "", operator = "", raw = ""] = cells;
      if (!raw && !destination && !operator) return;
      entries.push({ id: String(i + 1), category, destination, operator, raw });
    });

    return { entries };
  }
}