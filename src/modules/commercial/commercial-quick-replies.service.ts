import {
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "src/infrastructure/prisma/prisma.service";
import * as XLSX from "xlsx";

export interface QuickReplyEntry {
  id: string;
  title: string;
  text: string;
}

export interface QuickRepliesData {
  entries: QuickReplyEntry[];
  checkedAt: string;
}

@Injectable()
export class CommercialQuickRepliesService {
  private readonly logger = new Logger(CommercialQuickRepliesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReplies(): Promise<QuickRepliesData> {
    try {
      const dbEntries = await this.prisma.commercialQuickReply.findMany({
        orderBy: { rowIndex: "asc" },
      });

      const entries: QuickReplyEntry[] = dbEntries.map((e) => ({
        id: e.id,
        title: e.title,
        text: e.text,
      }));

      return {
        entries,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error("Error cargando respuestas rápidas:", error);
      throw new Error("No se pudieron cargar las respuestas rápidas.");
    }
  }

  async importFromExcel(fileBuffer: Buffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

      await this.prisma.commercialQuickReply.deleteMany();

      const entriesToInsert: Array<{ title: string; text: string; rowIndex: number }> = [];
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i];
        const title = (cells[0] ?? "").trim();
        const text = (cells[1] ?? "").trim();

        if (!title && !text) continue;
        if (i === 0 && /^(t[ií]tulo|title|pregunta)$/i.test(title)) continue;

        entriesToInsert.push({
          title,
          text,
          rowIndex: i,
        });
      }

      if (entriesToInsert.length > 0) {
        await this.prisma.commercialQuickReply.createMany({ data: entriesToInsert });
      }

      return { success: true, imported: entriesToInsert.length };
    } catch (error: any) {
      this.logger.error("Error importando respuestas:", error);
      throw new BadRequestException(`Error al importar: ${error.message}`);
    }
  }

  async createReply(title: string, text: string) {
    const count = await this.prisma.commercialQuickReply.count();
    return this.prisma.commercialQuickReply.create({
      data: { title, text, rowIndex: count },
    });
  }

  async updateReply(id: string, title: string, text: string) {
    return this.prisma.commercialQuickReply.update({
      where: { id },
      data: { title, text },
    });
  }

  async deleteReply(id: string) {
    return this.prisma.commercialQuickReply.delete({ where: { id } });
  }
}