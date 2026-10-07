import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { envs } from 'src/config/env.config';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RequestContext } from '../context/request-context.store';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'] as string | undefined;

    if (!header) {
      this.logger.warn(
        `Auth failed: Authorization header missing for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Token not found');
    }

    if (!header.startsWith('Bearer ')) {
      this.logger.warn(
        `Auth failed: Invalid header format for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid token format');
    }

    let decoded: { userId?: string };

    try {
      const token = header.replace('Bearer ', '').trim();
      decoded = verify(token, envs.JWT_SECRET) as { userId?: string };
    } catch (err) {
      this.logger.warn(
        `Auth failed: Token verification failed (${(err as Error).message}) for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid token');
    }

    if (!decoded.userId) {
      this.logger.warn(
        `Auth failed: Payload missing userId for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isLeader: true,
        isSupport: true,
        status: true,
        area: true,
        department: true,
        leaderId: true,
        managerId: true,
        avatarUrl: true,
        canPublishInFeed: true,
        modulePermissions: {
          where: { canAccess: true },
          select: { module: true, canAccess: true, actions: true },
        },
      },
    });

    if (!user) {
      this.logger.warn(
        `Auth failed: User ${decoded.userId} not found in database`,
      );
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.status !== 'ACTIVE') {
      this.logger.warn(
        `Auth failed: User ${user.email} (ID: ${user.userId}) is INACTIVE`,
      );
      throw new UnauthorizedException('User is not active');
    }

    RequestContext.set('userId', user.userId);
    RequestContext.set('userEmail', user.email);

    request.user = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatar: user.avatarUrl,
      role: user.role,
      isLeader: user.isLeader,
      isSupport: user.isSupport,
      status: user.status,
      area: user.area,
      department: user.department,
      leaderId: user.leaderId,
      managerId: user.managerId,
      canPublishInFeed: user.canPublishInFeed,
      modulePermissions: user.modulePermissions,
    };

    return true;
  }
}