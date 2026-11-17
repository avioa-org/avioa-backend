// import {
//   BadRequestException,
//   Injectable,
//   Logger,
// } from "@nestjs/common";
// import { PrismaService } from "src/infrastructure/prisma/prisma.service";
// import * as XLSX from "xlsx";

// export interface TableRow {
//   id: string;
//   cells: string[];
// }

// export interface TableEntry {
//   id: string;
//   destination: string;
//   operator: string;
//   raw: string;
//   category: string;
// }

// export interface TableData {
//   headers?: string[];
//   notes?: string[];
//   rows?: TableRow[];
//   entries?: TableEntry[];
//   checkedAt?: string;
//   warning?: string;
// }

// @Injectable()
// export class CommercialDriveTablesService {
//   private readonly logger = new Logger(CommercialDriveTablesService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   // =========================================================================
//   // 1. LECTURA DESDE LA BASE DE DATOS (Para el GET del frontend)
//   // =========================================================================
//   async getTable(source: string, force = false): Promise<TableData> {
//     if (source === "operadores") {
//       const operators = await this.prisma.commercialOperator.findMany({
//         orderBy: { category: "asc" },
//       });
//       return {
//         entries: operators.map((o) => ({
//           id: o.id,
//           category: o.category,
//           destination: o.destination,
//           operator: o.operator,
//           raw: o.raw,
//         })),
//         checkedAt: new Date().toISOString(),
//       };
//     }

//     const table = await this.prisma.commercialRateTable.findUnique({
//       where: { slug: source },
//       include: { rows: { orderBy: { rowIndex: "asc" } } },
//     });

//     if (!table) {
//       throw new BadRequestException(`La tabla "${source}" no existe en la base de datos.`);
//     }

//     return {
//       headers: table.headers,
//       notes: table.notes,
//       rows: table.rows.map((r) => ({ id: String(r.rowIndex), cells: r.cells })),
//       checkedAt: table.checkedAt.toISOString(),
//     };
//   }

//   // =========================================================================
//   // 2. IMPORTACIÓN DESDE EXCEL (Para el POST del frontend)
//   // =========================================================================
//   async importFromExcel(fileBuffer: Buffer, source: string) {
//     try {
//       // Leer el archivo binario con la librería XLSX
//       const workbook = XLSX.read(fileBuffer, { type: "buffer" });
//       const sheetName = workbook.SheetNames[0];
//       const sheet = workbook.Sheets[sheetName];
      
//       // Convertir a matriz string[][] (1 = array de arrays, raw: false para mantener formato)
//       const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { 
//         header: 1, 
//         raw: false, 
//         defval: "" 
//       });

//       let parsedData: any;
      
//       if (source === "operadores") {
//         parsedData = this.parseOperators(rows);
//       } else if (source === "naio") {
//         parsedData = this.parseCalendar(rows);
//       } else {
//         parsedData = this.parseTable(rows);
//       }

//       // Guardar en Prisma
//       if (source === "operadores") {
//         await this.prisma.commercialOperator.deleteMany();
//         if (parsedData.entries) {
//           await this.prisma.commercialOperator.createMany({
//             data: parsedData.entries.map((e: any) => ({
//               category: e.category,
//               destination: e.destination,
//               operator: e.operator,
//               raw: e.raw,
//             })),
//           });
//         }
//       } else {
//         await this.prisma.commercialRateTable.deleteMany({ where: { slug: source } });
//         await this.prisma.commercialRateTable.create({
//           data: {
//             slug: source,
//             title: source.toUpperCase(),
//             headers: parsedData.headers || [],
//             notes: parsedData.notes || [],
//             rows: {
//               create: (parsedData.rows || []).map((r: any, i: number) => ({
//                 rowIndex: i,
//                 cells: r.cells,
//               })),
//             },
//           },
//         });
//       }

//       this.logger.log(`Tabla ${source} importada correctamente.`);
//       return { success: true, message: "Importación exitosa." };
//     } catch (error: any) {
//       this.logger.error(`Error importando ${source}: ${error.message}`);
//       throw new BadRequestException(`No se pudo importar el archivo: ${error.message}`);
//     }
//   }

//   // =========================================================================
//   // 3. LOS PARSERS (El mismo código que teníamos, adaptado para matrices)
//   // =========================================================================

//   private parseTable(rows: string[][]): { headers: string[], notes: string[], rows: TableRow[] } {
//     if (rows.length === 0) return { rows: [], headers: [], notes: [] };

//     const headerIdx = rows.findIndex((r) => r.filter((c) => c && c.trim() !== "").length >= 3);
//     const idx = headerIdx === -1 ? (rows[0]?.length > 0 ? 0 : 1) : headerIdx;

//     const main = rows[idx] || [];
//     const sub = rows[idx + 1] || [];
//     const dataStart = idx + 1; 
//     const maxWidth = Math.max(0, ...rows.map((r) => r.length));

//     const clean = (s: string) => (s || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();

//     const headers: string[] = [];
//     for (let i = 0; i < maxWidth; i++) {
//       const a = clean(main[i]);
//       const b = clean(sub[i]);
      
//       let label = "";
//       if (a && b && !b.includes(a) && a !== b) label = `${a} · ${b}`;
//       else label = a || b;

//       headers.push(label ? label.toUpperCase() : `COL ${i + 1}`);
//     }

//     const notes: string[] = [];
//     for (let i = 0; i < idx; i++) {
//       const line = (rows[i] || []).filter(Boolean).join(" · ").trim();
//       if (line) notes.push(line);
//     }

//     const dataRows: TableRow[] = [];
//     for (let i = dataStart; i < rows.length; i++) {
//       const r = rows[i];
//       if (!r.some((c) => c && c.trim())) continue; 
//       dataRows.push({
//         id: String(i + 1),
//         cells: headers.map((_, j) => r[j] || ""),
//       });
//     }

//     return { headers, notes, rows: dataRows };
//   }

//   private parseCalendar(rows: string[][]): { headers: string[], notes: string[], rows: TableRow[] } {
//     if (rows.length === 0) return { rows: [], headers: [], notes: [] };

//     const maxWidth = Math.max(0, ...rows.map((r) => r.length));
//     const headers: string[] = [];

//     const firstDayRow = rows[1] || []; 
//     const firstDataRow = rows[2] || [];

//     for (let i = 0; i < maxWidth; i++) {
//         if (i === 0) {
//             headers.push("MES"); 
//             continue;
//         }
        
//         const dayLetter = (firstDayRow[i] || "").trim();
//         const dayNum = (firstDataRow[i] || "").trim();
        
//         if (!dayLetter && !dayNum) {
//             headers.push(""); 
//         } else {
//             headers.push(`${dayLetter} ${dayNum}`.trim().toUpperCase());
//         }
//     }

//     const dataRows: TableRow[] = [];
//     for (let i = 1; i < rows.length; i++) {
//       const r = rows[i];
//       if (!r.some((c) => c && c.trim())) continue;
//       const cells = headers.map((_, j) => r[j] || "");
//       dataRows.push({ id: String(i + 1), cells });
//     }

//     return { headers, notes: [], rows: dataRows };
//   }

//   private parseOperators(rows: string[][]): { entries: TableEntry[] } {
//     const entries: TableEntry[] = [];

//     rows.forEach((r, i) => {
//       const cells = r.map((c) => (c || "").trim());
//       if (!cells.some(Boolean)) return;
//       const [category = "", destination = "", operator = "", raw = ""] = cells;
//       if (!raw && !destination && !operator) return;
//       entries.push({ id: String(i + 1), category, destination, operator, raw });
//     });

//     return { entries };
//   }
// }