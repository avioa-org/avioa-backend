import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  OffersRuntimeResponse,
  OffersRuntimeService,
} from 'src/infrastructure/offers-runtime/offers-runtime.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { PortalUser } from './offers-manager.types';

@Injectable()
export class OffersManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: OffersRuntimeService,
  ) {}

  private permission(user: PortalUser, key: string) {
    return user.modulePermissions?.find((p) => p.module === key && p.canAccess);
  }

  private assertRead(user: PortalUser) {
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

  private assertAction(user: PortalUser, action: string) {
    if (
      user.role !== 'ADMIN' &&
      !this.permission(user, 'OFFERS')?.actions?.includes(action)
    ) {
      throw new ForbiddenException('Acción de Ofertas no autorizada.');
    }
  }

  getRuntimeHtml(user: PortalUser): Promise<string> {
    this.assertRead(user);
    return this.runtime.getHtml();
  }

  async dispatch(
    user: PortalUser,
    path: string,
    method: string,
    query: string,
    body: Record<string, unknown> = {},
  ): Promise<OffersRuntimeResponse> {
    this.assertRead(user);

    if (path === 'hunter/status' && method === 'GET') return {status:200,contentType:'application/json',body:JSON.stringify(await this.runtime.hunterStatus())};
    if (path === 'hunter/sync' && method === 'POST') { this.assertAction(user,'update');return {status:202,contentType:'application/json',body:JSON.stringify(this.runtime.hunterStart(body.full===true))}; }

    const approver =
      user.role === 'ADMIN' || !!this.permission(user, 'OFFERS_APPROVE');

    // Reglas específicas por ruta (antes estaban en el `handle` original)
    if (method !== 'GET') {
      if (path === 'approve') return { status: 410, contentType: 'application/json', body: JSON.stringify({error:'El flujo de estados se retiró. Guarda la oferta para actualizarla.'}) };
      if (path === 'initialize') {
        return {
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error:
              'Importa primero la exportación completa del Site; no se inicializa con datos de ejemplo.',
          }),
        };
      }
      if (path === 'state') {
        await this.assertStateActions(user, body);
        method = 'PUT';
      }
      if (path === 'product-import/commit') {
        const current = await this.prisma.offersWorkspaceState.findUnique({where:{id:1}});
        if (!current) throw new BadRequestException('Importa primero el respaldo completo.');
        if (!Array.isArray(body.selected)) throw new BadRequestException('Selecciona ofertas.');
        let rows: any[];
        try { rows = this.runtime.prepareImport(body, JSON.parse(current.payload)); }
        catch { throw new BadRequestException('Formato de importación inválido.'); }
        for (const index of body.selected as number[]) {
          if (!Number.isInteger(index) || !rows[index]) throw new BadRequestException('Selección inválida.');
          if (!rows[index].duplicateId) this.assertAction(user, rows[index].replaceId ? 'update' : 'create');
        }
      }
      if (path === 'workbook-sync') {
        const current = await this.prisma.offersWorkspaceState.findUnique({
          where: { id: 1 },
        });
        return {
          status: current ? 200 : 409,
          contentType: 'application/json',
          body: JSON.stringify(
            current
              ? {
                  revision: current.revision,
                  payload: this.runtime.normalizePayload(JSON.parse(current.payload)),
                  updatedAt: current.updatedAt,
                }
              : { error: 'Importa primero el respaldo completo.' },
          ),
        };
      }
    }

    return this.runtime.dispatch({
      user,
      role: approver ? 'approver' : 'editor',
      path,
      method,
      query,
      body,
    });
  }

  private async assertStateActions(
    user: PortalUser,
    input: Record<string, any>,
  ) {
    const before = await this.prisma.offersWorkspaceState.findUnique({
      where: { id: 1 },
    });

    const oldPayload = before ? this.runtime.normalizePayload(JSON.parse(before.payload)) : {offers:[]};
    const old: any[] = oldPayload.offers;
    let next: any[] = input.payload?.offers;

    if (!Array.isArray(next)) {
      throw new BadRequestException('Formato de ofertas inválido');
    }

    try { next = this.runtime.plannedState(input.payload, oldPayload).offers; }
    catch { throw new BadRequestException('Formato de ofertas inválido o varias modificaciones con el mismo nombre.'); }
    const oldById = new Map(old.map((o) => [o.id, o]));
    const newById = new Map(next.map((o) => [o.id, o]));

    if (next.some((o) => !oldById.has(o.id))) this.assertAction(user, 'create');
    if (
      next.some(
        (o) =>
          oldById.has(o.id) &&
          JSON.stringify(oldById.get(o.id)) !== JSON.stringify(o),
      ) ||
      JSON.stringify(input.payload.productoDefaults || {}) !==
        JSON.stringify(
          before ? JSON.parse(before.payload).productoDefaults || {} : {},
        )
    ) {
      this.assertAction(user, 'update');
    }
    if (old.some((o) => !newById.has(o.id))) this.assertAction(user, 'delete');
  }
}
