import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

/**
 * valida que quien revisa es el lider asignado en la solicitud
 * y que sigue PENDING, luego inyecta el record en
 * request.leaveRecordpara que el service no lo vuelva a consultar.
 */
@Injectable()
export class LeaveLeaderGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const role = request.user?.role;
    const leaveRequestId = request.params?.id;

    const record = await this.prisma.leaveRequest.findUnique({
      where: { leaveRequestId },
    });

    if (!record) {
      throw new NotFoundException({ message: 'Solicitud no encontrada' });
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

    request.leaveRecord = record;
    return true;
  }
}
