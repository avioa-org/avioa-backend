import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from 'generated/prisma/enums';

@Injectable()
export class CanPublishGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const allowed =
      user.role === Role.ADMIN ||
      user.role === Role.LEADER ||
      user.isLeader === true ||
      user.role === Role.MANAGER ||
      user.canPublishInFeed === true;

    if (!allowed) {
      throw new ForbiddenException(
        'No tienes permisos para publicar en el feed',
      );
    }

    return true;
  }
}
