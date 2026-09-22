import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class OvertimeLeaderGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const role = request.user?.role;
    const overtimeRequestId = request.params?.id;

    const record = await this.prisma.overtimeRequest.findUnique({
      where: { overtimeRequestId },
    });

    if (!record) {
      throw new NotFoundException({
        message: 'Overtime request not found',
      });
    }

    if (role !== 'ADMIN' && record.leaderId !== userId) {
      throw new ForbiddenException({
        message: 'No tienes permiso para revisar esta solicitud',
      });
    }

    if (record.status !== 'PENDING') {
      throw new ForbiddenException({
        message: 'Esta solicitud ya fue revisada',
      });
    }

    request.overtimeRecord = record;

    return true;
  }
}
