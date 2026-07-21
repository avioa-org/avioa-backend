import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { ICurrentUser } from '../decorator/current-user.decorator';
import { Role } from 'generated/prisma/enums';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ¿ 'actor' puede ver/gestionar los datos del empleado 'targetUserId' ?
   *
   * - ADMIN / MANAGER de RRHH: sí, a todos.
   * - Uno mismo: siempre puede verse.
   * - LEADER: solo a los empleados cuyo leaderId es el suyo
   * - MANAGER: a los empleados de los lidereres que le reportan
   */

  async canAccessUser(
    actor: ICurrentUser,
    targetUserId: string,
  ): Promise<boolean> {
    if (actor.role === Role.ADMIN) return true;
    if (actor.userId === targetUserId) return true;

    const target = await this.prisma.user.findUnique({
      where: { userId: targetUserId },
      select: { userId: true, leaderId: true, managerId: true },
    });

    if (!target) return false;

    if (actor.role === Role.MANAGER) {
      // Empleado directo del manager, o empleado de un lider que le reporta
      if (target.managerId === actor.userId) return true;
      if (target.leaderId) {
        const leader = await this.prisma.user.findUnique({
          where: { userId: target.leaderId },
          select: { managerId: true },
        });
        return leader?.managerId === actor.userId;
      }
    }

    return false;
  }

  /**
   * Igual que canAccessUser pero lanza 403 en vez de devolver false.
   * El uso de esto es para cuando se quiere cortar el flujo de una y no devolver un booleano
   */
  async assertCanAccessUser(
    actor: ICurrentUser,
    targetUserId: string,
  ): Promise<void> {
    const ok = await this.canAccessUser(actor, targetUserId);
    if (!ok) {
      throw new ForbiddenException({
        message: 'No tienes permiso para acceder a este recurso',
        error: 'RESOURCE_FORBIDDEN',
      });
    }
  }

  /**
   * ¿ 'actor' puede revisar/aprobar una solicitud?
   * Recibe el leaderId dueño de la solicitud. ADMIN siempre; el resto solo
   * si es el lider asignado a esa solicitud
   */
  canReviewRequest(actor: ICurrentUser, requestLeaderId: string): boolean {
    if (actor.role === Role.ADMIN) return true;
    return actor.userId === requestLeaderId;
  }

  assertCanReviewRequest(actor: ICurrentUser, requestLeaderId: string): void {
    if (!this.canReviewRequest(actor, requestLeaderId)) {
      throw new ForbiddenException({
        message: 'No tienes permiso para revisar esta solicitud',
        error: 'REVIEW_FORBIDDEN',
      });
    }
  }

  /**
   * Devuleve el filtro Prisma 'where' que limita una consulta al ámbito
   * permitido del actor. Se usa en listados para que cada quien vea solo
   * lo suyo SIN recibir el filtro a mano en cada request.
   *
   * Ejemplo:
   *    const scope = await auth.scopeForUserQuery(user);
   *    prisma.user.findMany({ where: { ...scope, status: 'ACTIVE' }})
   */
  async scopeForUserQuery(
    actor: ICurrentUser,
  ): Promise<Record<string, unknown>> {
    if (actor.role === Role.ADMIN) return {};

    if (actor.role == Role.LEADER) {
      return { OR: [{ leaderId: actor.userId }, { userId: actor.userId }] };
    }

    if (actor.role === Role.MANAGER) {
      const leaders = await this.prisma.user.findMany({
        where: { managerId: actor.userId, role: Role.LEADER },
        select: { userId: true },
      });

      const leaderIds = leaders.map((l) => l.userId);

      return {
        OR: [
          { managerId: actor.userId },
          { leaderId: { in: leaderIds } },
          { userId: actor.userId },
        ],
      };
    }

    // EMPLOYEE: solo se ve a sí mismo
    return { userId: actor.userId };
  }
}
