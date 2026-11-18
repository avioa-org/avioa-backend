import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import * as XLSX from 'xlsx';
@Injectable()
export class OperatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.commercialOperator.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async create(data: { category: string; destination: string; operator: string; raw: string }) {
    return this.prisma.commercialOperator.create({ data });
  }

  async delete(id: string) {
    return this.prisma.commercialOperator.delete({ where: { id } });
  }

   async importFromExcel(fileBuffer: Buffer, category: string = "") {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      if (rows.length === 0) throw new Error('El archivo está vacío.');

      // Buscar la fila de encabezados (que contenga "DESTINO" o "OPERADOR")
      const headerIdx = rows.findIndex((r) => 
        r.some(c => String(c).toUpperCase().includes("DESTINO") || String(c).toUpperCase().includes("OPERADOR"))
      );

      const dataStart = headerIdx !== -1 ? headerIdx + 1 : 1; // Si no encuentra encabezados, empieza en la fila 1
      
      const rowsToInsert: any[] = [];
      
      for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        // Filtramos filas vacías
        if (!r || !r.some(c => c && String(c).trim() !== "")) continue;

        const destination = String(r[0] || '').trim();
        const operator = String(r[1] || '').trim();
        const raw = String(r[2] || '').trim();

        if (!destination && !operator) continue; // Si no hay ni destino ni operador, lo saltamos

        rowsToInsert.push({
          category: category.trim() || 'General', // Si el usuario no pone categoría, usa "General"
          destination,
          operator,
          raw,
        });
      }

      if (rowsToInsert.length === 0) {
        throw new Error('No se encontraron operadores válidos en el archivo.');
      }

      // Guardamos en Prisma
      await this.prisma.commercialOperator.createMany({ data: rowsToInsert });

      return { success: true, imported: rowsToInsert.length };
    } catch (error: any) {
      console.error("❌ Error importando operadores:", error);
      throw new BadRequestException(`Error al importar: ${error.message}`);
    }
  }
}


