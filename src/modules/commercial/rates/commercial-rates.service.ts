// src/modules/commercial/rates/commercial-rates.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class CommercialRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTables() {
    return this.prisma.commercialRateTable.findMany({
      where: { isActive: true },
      select: { slug: true, title: true, year: true, type: true },
      orderBy: [{ year: 'desc' }, { type: 'asc' }],
    });
  }

  async getTable(slug: string) {
    const table = await this.prisma.commercialRateTable.findUnique({
      where: { slug },
      include: { rows: { orderBy: { rowIndex: 'asc' } } },
    });
    if (!table) throw new NotFoundException('Tabla no encontrada');
    
    return {
      id: table.id,
      title: table.title,
      rows: table.rows,
      checkedAt: table.checkedAt.toISOString(),
    };
  }

  async createTable(title: string, slug: string, year: number, type: string) {
    const exists = await this.prisma.commercialRateTable.findUnique({ where: { slug } });
    if (exists) throw new BadRequestException('Esa tabla ya existe.');

    return this.prisma.commercialRateTable.create({
      data: { title, slug, year, type },
    });
  }

  async addRow(tableId: string, data: any) {
    const lastRow = await this.prisma.commercialRateRow.findFirst({
      where: { tableId },
      orderBy: { rowIndex: 'desc' },
    });
    const nextIndex = lastRow ? lastRow.rowIndex + 1 : 0;

    return this.prisma.commercialRateRow.create({
      data: {
        tableId,
        rowIndex: nextIndex,
        destination: data.destination || '',
        hotel: data.hotel || '',
        date: data.date || '',
        mealPlan: data.mealPlan || '',
        singleRate: data.singleRate || '',
        doubleAdult: data.doubleAdult || '',
        doubleChild: data.doubleChild || '',
        multipleAdult: data.multipleAdult || '',
        multipleChild: data.multipleChild || '',
        childAge: data.childAge || '',
      },
    });
  }

  async deleteRow(tableId: string, rowIndex: number) {
    return this.prisma.commercialRateRow.deleteMany({
      where: { tableId, rowIndex },
    });
  }

  // ==========================================
  // IMPORTACIÓN DESDE EXCEL
  // ==========================================
  async importFromExcel(fileBuffer: Buffer, source: string) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      
      // Mapeo de nombres de pestañas por si el Excel tiene varias
      const sheetMap: Record<string, string[]> = {
        alta2026: ["ALTA 2026", "ALTA2026"],
        baja2026: ["BAJA 2026", "BAJA2026"],
        "alta-2026": ["ALTA 2026", "ALTA2026"],
        "baja-2026": ["BAJA 2026", "BAJA2026"],
        baja2027: ["BAJA 2027", "BAJA2027"],
      };

      const expectedNames = sheetMap[source] || [];
      const actualSheetName = workbook.SheetNames.find((name) => 
        expectedNames.some(p => name.trim().toUpperCase().includes(p))
      );

      const sheetName = actualSheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

      // Buscamos la fila de encabezados
      const headerIdx = rows.findIndex((r) => r.filter((c) => c && c.trim() !== "").length >= 3);
      if (headerIdx === -1) throw new Error("No se encontraron encabezados válidos.");
      
      const dataStart = headerIdx + 1;
      
      // Limpiamos los datos anteriores de esta tabla
      const table = await this.prisma.commercialRateTable.findUnique({ where: { slug: source } });
      if (!table) throw new Error(`La tabla ${source} no existe en la base de datos.`);

      await this.prisma.commercialRateRow.deleteMany({ where: { tableId: table.id } });

      // Insertamos las nuevas filas
      const rowsToInsert: any[] = [];
      for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        if (!r.some((c) => c && c.trim())) continue;

        rowsToInsert.push({
          tableId: table.id,
          rowIndex: i - dataStart, 
          destination: r[0] || "",
          hotel: r[1] || "",
          date: r[2] || "",
          mealPlan: r[3] || "",
          singleRate: r[4] || "",
          doubleAdult: r[5] || "",
          doubleChild: r[6] || "",
          multipleAdult: r[7] || "",
          multipleChild: r[8] || "",
          childAge: r[9] || "",
        });
      }

      if (rowsToInsert.length > 0) {
        await this.prisma.commercialRateRow.createMany({ data: rowsToInsert });
      }

      return { success: true, imported: rowsToInsert.length };
    } catch (error: any) {
      throw new BadRequestException(`Error al importar: ${error.message}`);
    }
  }
}