import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { verify } from 'jsonwebtoken';
import { envs } from 'src/config/env.config';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'] as string | undefined;

    if (!header) {
      throw new UnauthorizedException('Token not found');
    }

    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }

    let decoded: { userId?: string };

    try {
      const token = header.replace('Bearer ', '').trim();
      decoded = verify(token, envs.JWT_SECRET) as { userId?: string };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!decoded.userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        area: true,
        department: true,
        leaderId: true,
        managerId: true,
        avatarUrl: true,
        canPublishInFeed: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    request.user = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatar: user.avatarUrl,
      role: user.role,
      status: user.status,
      area: user.area,
      department: user.department,
      leaderId: user.leaderId,
      managerId: user.managerId,
      canPublishInFeed: user.canPublishInFeed,
    };

    return true;
  }
}
