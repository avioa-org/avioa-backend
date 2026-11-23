import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "src/infrastructure/prisma/prisma.service";

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

@Injectable()
export class CommercialProtocolService {
  private readonly logger = new Logger(CommercialProtocolService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProtocol(z): Promise<ProtocolResponse> {
    try {
      const dbSections = await this.prisma.commercialProtocolSection.findMany({
        orderBy: { rowIndex: "asc" },
        include: {
          steps: { orderBy: { rowIndex: "asc" } },
        },
      });

      const sections: ProtocolSection[] = dbSections.map((s) => ({
        id: s.id,
        title: s.title,
        row: s.rowIndex,
        steps: s.steps.map((step) => ({
          id: step.id,
          row: step.rowIndex,
          label: step.label,
          text: step.text,
        })),
      }));

      return {
        sections,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error("Error cargando protocolo:", error);
      throw new Error("No se pudo cargar el protocolo.");
    }
  }

    async importFromExcel(fileBuffer: Buffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

      // Limpiamos la base de datos antes de importar
      await this.prisma.commercialProtocolSection.deleteMany();

      let currentSection: any = null;
      let sectionCount = 0;
      let objection = "";

      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].slice(0, 3).map(v => (v || "").trim());
        const [a, b, c] = cells;
        if (!cells.some(Boolean)) continue;

        if (/^escenario\s*\d+/i.test(a) || /^manejo de objeciones$/i.test(a)) {
          const title = cells.filter(Boolean).join(" · ");
          currentSection = await this.prisma.commercialProtocolSection.create({
            data: { title, rowIndex: sectionCount++ }
          });
          objection = "";
          continue;
        }

        if (!currentSection) continue;
        if (/^manejo de objeciones/i.test(currentSection.title) && a) objection = a;

        const text = c || b || "";
        const label = c ? [a || objection, b].filter(Boolean).join(" · ") : a || objection;

        await this.prisma.commercialProtocolStep.create({
          data: { sectionId: currentSection.id, label, text, rowIndex: i }
        });
      }

      return { success: true, imported: true };
    } catch (error: any) {
      this.logger.error("Error importando protocolo:", error);
      throw new BadRequestException(`Error al importar: ${error.message}`);
    }
  }

  async updateSection(id: string, title: string) {
    return this.prisma.commercialProtocolSection.update({
      where: { id },
      data: { title },
    });
  }


  async createSection(title: string) {
    const count = await this.prisma.commercialProtocolSection.count();
    return this.prisma.commercialProtocolSection.create({
      data: { title, rowIndex: count },
    });
  }

  async deleteSection(id: string) {
    return this.prisma.commercialProtocolSection.delete({ where: { id } });
  }


  async createStep(sectionId: string, label: string, text: string) {
    const count = await this.prisma.commercialProtocolStep.count({
      where: { sectionId },
    });
    return this.prisma.commercialProtocolStep.create({
      data: { sectionId, label, text, rowIndex: count },
    });
  }

  async deleteStep(id: string) {
    return this.prisma.commercialProtocolStep.delete({ where: { id } });
  }
}