import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/infrastructure/prisma/prisma.service";
import {
  VideoActionDto,
  VideoEntryDto,
} from "./dto/video.dto";

export interface DriveVideo {
  title: string;
  description: string;
  url: string;
}

export interface VideoEntry {
  id: string;
  revision: number;
  source: "db" | "drive";
  title: string;
  description: string;
  url: string;
}

export interface VideosResponse {
  entries: VideoEntry[];
  added: number;
  skipped: number;
  checkedAt?: string;
  warning?: string;
}

const DRIVE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU/gviz/tq?tqx=out:csv&gid=1125647686";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

@Injectable()
export class CommercialVideosService {
  private readonly logger = new Logger(CommercialVideosService.name);
  private cache: { entries: DriveVideo[]; checkedAt: Date } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async list(force = false): Promise<VideosResponse> {
    const dbEntries = await this.prisma.commercialVideo.findMany({
      orderBy: { updatedAt: "desc" },
    });

    const { entries: driveEntries, checkedAt, warning } =
      await this.loadDrive(force);

    const all: VideoEntry[] = [
      ...dbEntries.map((v) => ({
        id: v.id,
        revision: v.revision,
        source: v.source as "db" | "drive",
        title: v.title,
        description: v.description,
        url: v.url,
      })),
      ...driveEntries.map((v, idx) => ({
        id: `drive-${idx}`,
        revision: 0,
        source: "drive" as const,
        title: v.title,
        description: v.description,
        url: v.url,
      })),
    ];

    return {
      entries: all,
      added: 0,
      skipped: 0,
      checkedAt: checkedAt?.toISOString(),
      warning,
    };
  }

  private async loadDrive(force: boolean): Promise<{
    entries: DriveVideo[];
    checkedAt: Date | null;
    warning?: string;
  }> {
    const now = Date.now();
    if (
      !force &&
      this.cache &&
      now - this.cache.checkedAt.getTime() < CACHE_TTL_MS
    ) {
      return { entries: this.cache.entries, checkedAt: this.cache.checkedAt };
    }

    try {
      const res = await fetch(DRIVE_CSV_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Drive HTTP ${res.status}`);
      const csv = await res.text();
      const entries = this.parseCsv(csv);
      const checkedAt = new Date();
      this.cache = { entries, checkedAt };
      return { entries, checkedAt };
    } catch (e) {
      this.logger.warn(`Drive inaccesible: ${(e as Error).message}`);
      if (this.cache) {
        return {
          entries: this.cache.entries,
          checkedAt: this.cache.checkedAt,
          warning:
            "No se pudo consultar Drive. Se muestran datos en caché de hace " +
            Math.round((now - this.cache.checkedAt.getTime()) / 60000) +
            " min.",
        };
      }
      return {
        entries: [],
        checkedAt: null,
        warning: "No se pudo consultar Drive. Solo se muestran videos propios.",
      };
    }
  }

  private parseCsv(csv: string): DriveVideo[] {
    const rows = this.parseCsvRows(csv);
    if (rows.length === 0) return [];

    // Encontrar fila de header
    const headerIdx = rows.findIndex((r) =>
      r.some((v) =>
        ["nombre hotel", "hotel", "titulo"].includes(this.norm(v)),
      ),
    );
    if (headerIdx < 0) return [];

    const headers = rows[headerIdx].map((v) => this.norm(v));
    const ti = headers.findIndex((v) =>
      ["nombre hotel", "hotel", "titulo"].includes(v),
    );
    const di = headers.indexOf("descripcion");
    const ui = headers.findIndex((v) =>
      ["enlace", "url", "video"].includes(v),
    );

    if (ti < 0) return [];

    const entries: DriveVideo[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const title = (r[ti] ?? "").trim();
      const description = di >= 0 ? (r[di] ?? "").trim() : "";
      const rawUrl = ui >= 0 ? (r[ui] ?? "").trim() : "";
      if (!title || !rawUrl) continue;

      const url = this.safeUrl(rawUrl);
      if (!url) continue;

      entries.push({ title, description, url });
    }
    return entries;
  }

  private parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      const next = csv[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cell += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          row.push(cell);
          cell = "";
        } else if (c === "\n") {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        } else if (c !== "\r") {
          cell += c;
        }
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  private norm(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  private safeUrl(value: string): string {
    if (!value) return "";
    try {
      const u = new URL(value);
      if (
        !["https:", "http:"].includes(u.protocol) ||
        u.username ||
        u.password ||
        !u.hostname.includes(".")
      )
        return "";
      return u.href;
    } catch {
      return "";
    }
  }

  async handleAction(
    dto: VideoActionDto,
    userId: string,
  ): Promise<VideosResponse> {
    switch (dto.action) {
      case "add":
        return this.add(dto.entry!, userId);
      case "edit":
        return this.edit(dto.id!, dto.revision!, dto.entry!, userId);
      case "delete":
        return this.delete(dto.id!, dto.revision!);
      case "import":
        return this.importMany(dto.entries!, userId);
    }
  }

  private async add(
    entry: VideoEntryDto,
    userId: string,
  ): Promise<VideosResponse> {
    const url = this.safeUrl(entry.url);
    if (!url) throw new BadRequestException("Enlace inválido.");

    // Evitar duplicado por (title, url)
    const existing = await this.prisma.commercialVideo.findFirst({
      where: { title: entry.title.trim(), url },
    });
    if (existing) {
      const list = await this.list(false);
      return { ...list, added: 0, skipped: 1 };
    }

    await this.prisma.commercialVideo.create({
      data: {
        title: entry.title.trim(),
        description: entry.description?.trim() ?? "",
        url,
        source: "db",
        updatedBy: userId,
      },
    });
    const list = await this.list(false);
    return { ...list, added: 1, skipped: 0 };
  }

  private async edit(
    id: string,
    revision: number,
    entry: VideoEntryDto,
    userId: string,
  ): Promise<VideosResponse> {
    const url = this.safeUrl(entry.url);
    if (!url) throw new BadRequestException("Enlace inválido.");

    const current = await this.prisma.commercialVideo.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("Video no encontrado.");
    if (current.revision !== revision) {
      throw new ConflictException(
        "El video fue modificado por otro usuario. Recarga para continuar.",
      );
    }

    await this.prisma.commercialVideo.update({
      where: { id },
      data: {
        title: entry.title.trim(),
        description: entry.description?.trim() ?? "",
        url,
        revision: current.revision + 1,
        updatedBy: userId,
      },
    });
    const list = await this.list(false);
    return { ...list, added: 0, skipped: 0 };
  }

  private async delete(
    id: string,
    revision: number,
  ): Promise<VideosResponse> {
    const current = await this.prisma.commercialVideo.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("Video no encontrado.");
    if (current.revision !== revision) {
      throw new ConflictException(
        "El video fue modificado por otro usuario. Recarga para continuar.",
      );
    }
    await this.prisma.commercialVideo.delete({ where: { id } });
    const list = await this.list(false);
    return { ...list, added: 0, skipped: 0 };
  }

  private async importMany(
    entries: VideoEntryDto[],
    userId: string,
  ): Promise<VideosResponse> {
    if (!entries?.length) {
      throw new BadRequestException("No hay videos para importar.");
    }
    if (entries.length > 500) {
      throw new BadRequestException("Importa hasta 500 videos por archivo.");
    }

    let added = 0;
    let skipped = 0;

    for (const e of entries) {
      const url = this.safeUrl(e.url);
      if (!url) {
        skipped++;
        continue;
      }
      const existing = await this.prisma.commercialVideo.findFirst({
        where: { title: e.title.trim(), url },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await this.prisma.commercialVideo.create({
        data: {
          title: e.title.trim(),
          description: e.description?.trim() ?? "",
          url,
          source: "db",
          updatedBy: userId,
        },
      });
      added++;
    }

    const list = await this.list(false);
    return { ...list, added, skipped };
  }
}