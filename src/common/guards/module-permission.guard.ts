import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';
import {
  MODULES_KEY,
  ACTION_KEY,
  ModuleAction,
} from '../decorator/modules-permission.decorator';
import { Modules } from '../enum/modules.enum';
import { ICurrentUser } from '../decorator/current-user.decorator';
import { Role } from 'generated/prisma/enums';

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredModules = this.reflector.getAllAndOverride<Modules[]>(
      MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModules?.length) return true;

    const requiredAction = this.reflector.getAllAndOverride<ModuleAction>(
      ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;
    if (!user.userId) return false;

    if (user.role === Role.ADMIN) return true;
    if (
      (requiredModules.includes(Modules.OVERTIME) ||
        requiredModules.includes(Modules.LEAVES)) &&
      (user.role === Role.LEADER || user.isLeader)
    )
      return true;

    if (user.modulePermissions && Array.isArray(user.modulePermissions)) {
      const activePerms = user.modulePermissions.filter(
        (p) =>
          p.canAccess !== false &&
          requiredModules.includes(p.module as Modules),
      );

      if (activePerms.length === 0) return false;
      if (!requiredAction) return true;

      return activePerms.some((p) => {
        if (!p.actions || p.actions.length === 0) return true;
        return p.actions.includes(requiredAction);
      });
    }

    const perms = await this.prisma.modulePermission.findMany({
      where: {
        userId: user.userId,
        module: { in: requiredModules },
        canAccess: true,
      },
      select: { module: true, actions: true },
    });

    if (perms.length === 0) return false;
    if (!requiredAction) return true;

    return perms.some((p) => {
      if (!p.actions || p.actions.length === 0) return true;
      return p.actions.includes(requiredAction);
    });
  }
}
