import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface NiltzeIndex {
  operator: string;
  importedAt: string;
  sourceUrl: string;
  edition: string;
  sourceCount: number;
  emptyFolders: string[];
  items: Array<{
    id: string;
    title: string;
    category: string;
    theme: string;
    source: string;
    sourceSection: string;
    nights: number | null;
    days: number | null;
    modality: string;
    currency: string | null;
    adultPrice: number | null;
    priceBasis: string | null;
    warnings: string[];
    historical: boolean;
    searchText: string;
    highlights: string[];
  }>;
}

export interface NiltzeFullItem {
  id: string;
  title: string;
  category: string;
  theme: string;
  source: string;
  sourceSha256: string;
  sourceSection: string;
  blocks: Array<
    | { type: "text"; text: string }
    | {
        type: "table";
        rows: Array<Array<{ text: string; colSpan?: number; rowSpan?: number }>>;
      }
  >;
  nights: number | null;
  days: number | null;
  modality: string;
  currency: string | null;
  adultPrice: number | null;
  priceBasis: string | null;
  itinerary: string[];
  includes: string[];
  warnings: string[];
  historical: boolean;
  searchText: string;
}

interface NiltzeFullIndex extends Omit<NiltzeIndex, "items"> {
  items: NiltzeFullItem[];
}

@Injectable()
export class CommercialNiltzeService {
  private cache: NiltzeFullIndex | null = null;

  private load(): NiltzeFullIndex {
    if (this.cache) return this.cache;
    const filePath = path.join(__dirname, "niltze-catalog.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    this.cache = JSON.parse(raw) as NiltzeFullIndex;
    return this.cache;
  }

  /** Lista resumida (sin blocks/itinerary/includes/sha) para el index */
  list(): NiltzeIndex {
    const full = this.load();
    return {
      ...full,
      items: full.items.map((i) => {
        const { blocks, itinerary, includes, sourceSha256, ...rest } = i;
        // "highlights" = primeros textos relevantes (para preview en card)
        const highlights = this.extractHighlights(blocks);
        return { ...rest, highlights };
      }),
    };
  }

  /** Item completo por id */
  getById(id: string): NiltzeFullItem {
    const full = this.load();
    const item = full.items.find((i) => i.id === id);
    if (!item) throw new NotFoundException("Ficha no encontrada.");
    return item;
  }

  private extractHighlights(blocks: NiltzeFullItem["blocks"]): string[] {
    const texts: string[] = [];
    for (const b of blocks) {
      if (b.type === "text" && b.text.trim()) {
        texts.push(b.text.trim().slice(0, 180));
      }
      if (texts.length >= 2) break;
    }
    return texts;
  }
}