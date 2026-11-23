import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ICurrentUser } from 'src/common/decorator/current-user.decorator';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import {
  OffersHistoryEntry,
  OffersPayload,
  OffersSession,
  OffersWorkspaceSnapshot,
  SaveOffersPayloadRequest,
} from './types/offers-manager.native.types';

@Injectable()
export class OffersManagerNativeService {
  constructor(private readonly prisma: PrismaService) {}

  private permission(user: ICurrentUser, module: string) {
    return user.modulePermissions?.find(
      (p) => p.module === module && p.canAccess,
    );
  }

  private assertRead(user: ICurrentUser) {
    if (
      user.role !== 'ADMIN' &&
      (!this.permission(user, 'OFFERS') ||
        !this.permission(user, 'OFFERS_INTERNAL'))
    ) {
      throw new ForbiddenException(
        'Se requiere acceso al gestor y a la información interna de Producto.',
      );
    }
  }

  private assertAction(
    user: ICurrentUser,
    action: 'create' | 'update' | 'delete',
  ) {
    if (
      user.role !== 'ADMIN' &&
      !this.permission(user, 'OFFERS')?.actions?.includes(action)
    ) {
      throw new ForbiddenException(
        `Acción de Ofertas no autorizada: ${action}.`,
      );
    }
  }

  private isApprover(user: ICurrentUser) {
    return user.role === 'ADMIN' || !!this.permission(user, 'OFFERS_APPROVE');
  }

  async getSession(user: ICurrentUser): Promise<OffersSession> {
    this.assertRead(user);
    const actions = this.permission(user, 'OFFERS')?.actions ?? [];
    const approver = this.isApprover(user);
    return {
      userId: user.userId,
      email: user.email,
      role: approver ? 'approver' : 'editor',
      canRead: true,
      canCreate: user.role === 'ADMIN' || actions.includes('create'),
      canUpdate: user.role === 'ADMIN' || actions.includes('update'),
      canDelete: user.role === 'ADMIN' || actions.includes('delete'),
      canApprove: approver,
    };
  }

  async getSnapshot(user: ICurrentUser): Promise<OffersWorkspaceSnapshot> {
    this.assertRead(user);
    const row = await this.prisma.offersWorkspaceState.findUnique({
      where: { id: 1 },
    });
    if (!row)
      throw new NotFoundException('No existe un estado importado de Ofertas.');
    return {
      id: 1,
      revision: row.revision,
      payload: this.parsePayload(row.payload),
      updatedAt: row.updatedAt,
    };
  }

  async saveSnapshot(
    user: ICurrentUser,
    request: SaveOffersPayloadRequest,
  ): Promise<OffersWorkspaceSnapshot> {
    this.assertRead(user);
    const payload = this.validatePayload(request?.payload);
    if (
      !Number.isInteger(request?.expectedRevision) ||
      request.expectedRevision < 0
    ) {
      throw new BadRequestException(
        'expectedRevision debe ser un entero válido.',
      );
    }
    const current = await this.prisma.offersWorkspaceState.findUnique({
      where: { id: 1 },
    });
    if (!current)
      throw new NotFoundException('No existe un estado importado de Ofertas.');
    const previousPayload = this.parsePayload(current.payload);
    this.assertPayloadActions(previousPayload, payload, user);
    if (current.revision !== request.expectedRevision) {
      throw new ConflictException({
        message:
          'El estado cambió desde la última lectura. Recarga antes de guardar.',
        currentRevision: current.revision,
      });
    }

    const nextRevision = current.revision + 1;
    const now = new Date().toISOString();
    const payloadString = JSON.stringify(payload);
    const summary = this.makeSummary(previousPayload, payload);

    await this.prisma.$transaction(async (tx) => {
      // CAS update: prevents two clients from overwriting the same revision.
      const updated = await tx.offersWorkspaceState.updateMany({
        where: { id: 1, revision: request.expectedRevision },
        data: {
          revision: nextRevision,
          payload: payloadString,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'El estado cambió durante el guardado. Recarga e intenta de nuevo.',
        );
      }
      await tx.offersAuditHistory.create({
        data: {
          revision: nextRevision,
          actor: user.email,
          actorId: user.userId,
          action: 'native-save',
          createdAt: now,
          payload: payloadString,
          summary,
        },
      });
    });

    return { id: 1, revision: nextRevision, payload, updatedAt: now };
  }

  async getHistory(
    user: ICurrentUser,
    limit = 50,
  ): Promise<OffersHistoryEntry[]> {
    this.assertRead(user);
    const safeLimit = Math.min(Math.max(Math.trunc(limit || 50), 1), 100);
    const rows = await this.prisma.offersAuditHistory.findMany({
      orderBy: { revision: 'desc' },
      take: safeLimit,
    });
    return rows.map((row) => ({
      revision: row.revision,
      actor: row.actor,
      actorId: row.actorId,
      action: row.action,
      createdAt: row.createdAt,
      payload: this.parsePayload(row.payload),
      summary: row.summary,
    }));
  }

  async getHistoryRevision(
    user: ICurrentUser,
    revision: number,
  ): Promise<OffersHistoryEntry> {
    this.assertRead(user);
    if (!Number.isInteger(revision) || revision < 1)
      throw new BadRequestException('Revisión inválida.');
    const row = await this.prisma.offersAuditHistory.findUnique({
      where: { revision },
    });
    if (!row) throw new NotFoundException(`No existe la revisión ${revision}.`);
    return {
      revision: row.revision,
      actor: row.actor,
      actorId: row.actorId,
      action: row.action,
      createdAt: row.createdAt,
      payload: this.parsePayload(row.payload),
      summary: row.summary,
    };
  }

  private assertPayloadActions(
    before: OffersPayload,
    after: OffersPayload,
    user: ICurrentUser,
  ) {
    const oldById = new Map(before.offers.map((offer) => [offer.id, offer]));
    const newById = new Map(after.offers.map((offer) => [offer.id, offer]));
    if (after.offers.some((offer) => !oldById.has(offer.id)))
      this.assertAction(user, 'create');
    if (before.offers.some((offer) => !newById.has(offer.id)))
      this.assertAction(user, 'delete');
    const changed = after.offers.some(
      (offer) =>
        oldById.has(offer.id) &&
        JSON.stringify(oldById.get(offer.id)) !== JSON.stringify(offer),
    );
    const defaultsChanged =
      JSON.stringify(before.productoDefaults ?? {}) !==
      JSON.stringify(after.productoDefaults ?? {});
    if (changed || defaultsChanged) this.assertAction(user, 'update');
  }

  private validatePayload(input: unknown): OffersPayload {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('payload debe ser un objeto.');
    const payload = input as Record<string, unknown>;
    if (!Array.isArray(payload.offers))
      throw new BadRequestException('payload.offers debe ser un arreglo.');
    const ids = new Set<string>();
    for (const offer of payload.offers) {
      if (
        !offer ||
        typeof offer !== 'object' ||
        Array.isArray(offer) ||
        typeof offer.id !== 'string' ||
        !offer.id.trim()
      ) {
        throw new BadRequestException(
          'Cada oferta debe ser un objeto con id de texto.',
        );
      }
      const id = offer.id;
      if (ids.has(id))
        throw new BadRequestException(`ID de oferta duplicado: ${id}`);
      ids.add(id);
    }
    return payload as OffersPayload;
  }

  private parsePayload(raw: string): OffersPayload {
    try {
      return this.validatePayload(JSON.parse(raw));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'El payload almacenado de Ofertas no es JSON válido.',
      );
    }
  }

  private makeSummary(before: OffersPayload, after: OffersPayload): string {
    const oldIds = new Set(before.offers.map((o) => o.id));
    const newIds = new Set(after.offers.map((o) => o.id));
    const created = [...newIds].filter((id) => !oldIds.has(id)).length;
    const deleted = [...oldIds].filter((id) => !newIds.has(id)).length;
    const changed = after.offers.filter(
      (o) =>
        oldIds.has(o.id) &&
        JSON.stringify(before.offers.find((old) => old.id === o.id)) !==
          JSON.stringify(o),
    ).length;
    return `Guardado nativo: ${created} creadas, ${changed} modificadas, ${deleted} eliminadas.`;
  }
}
