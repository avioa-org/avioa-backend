import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { CommercialResourceKind } from "generated/prisma/enums";
import {
  CreateCommercialResourceDto,
  UpdateCommercialResourceDto,
} from "./dto/resource.dto";

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kind?: CommercialResourceKind) {
    return this.prisma.commercialResource.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string) {
    const resource = await this.prisma.commercialResource.findUnique({
      where: { id },
    });
    if (!resource) throw new NotFoundException("Recurso no encontrado");
    return resource;
  }

  async create(dto: CreateCommercialResourceDto) {
    return this.prisma.commercialResource.create({
      data: {
        kind: dto.kind,
        title: dto.title,
        text: dto.text ?? "",
        url: dto.url ?? "",
        category: dto.category ?? "",
        origin: dto.origin ?? "",
      },
    });
  }

  async update(id: string, dto: UpdateCommercialResourceDto) {
    await this.findOne(id); // lanza 404 si no existe
    return this.prisma.commercialResource.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title,
        text: dto.text ?? "",
        url: dto.url ?? "",
        category: dto.category ?? "",
        origin: dto.origin ?? "",
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // lanza 404 si no existe
    await this.prisma.commercialResource.delete({ where: { id } });
    return { ok: true };
  }
}