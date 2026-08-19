import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SocketGateway } from '../points/gateway/points.gateway';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import holidaysColombia from 'festivos-colombianos';
import { countBusinessDays } from './helpers/business-days.helper';
import {
  LeaveStatus,
  LeaveType,
  NotificationType,
} from 'generated/prisma/enums';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { LeaveRequest } from 'generated/prisma/browser';
import { ReviewLeaveDto } from './dto/review-leave.dto';

const VACATIONS_DAYS_PER_YEAR = 15;
@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly socketGateway: SocketGateway,
  ) {}

  public async create(userId: string, dto: CreateLeaveDto) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { leaderId: true, name: true, startDate: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const leaderId = dto.leaderId ?? user.leaderId;

    if (!leaderId) {
      throw new BadRequestException(
        'No tienes un lider asignado o no has seleccionado uno.',
      );
    }

    const [ys, ms, ds] = dto.startDate.split('-').map(Number);
    const [ye, me, de] = dto.endDate.split('-').map(Number);
    const startDate = new Date(ys, ms - 1, ds);
    const endDate = new Date(ye, me - 1, de);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Formato de fecha inválido');
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anteriro a la de inicio',
      );
    }

    const businessDays = countBusinessDays(startDate, endDate);

    if (businessDays === 0) {
      throw new BadRequestException(
        'El rango seleccionado no contiene dias hábiles',
      );
    }

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlap) {
      throw new BadRequestException(
        'Ya tienes una solicitud activa que se cruza con estas fechas',
      );
    }

    if (dto.type === LeaveType.VACACIONES) {
      const balance = await this.calculateVacationBalance(
        userId,
        user.startDate,
      );

      if (businessDays > balance.available) {
        throw new BadRequestException(
          `No tienes saldo suficiente. Disponibles: ${balance.available} días hábiles, solicitados: ${businessDays}.`,
        );
      }
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId,
        leaderId,
        type: dto.type,
        startDate,
        endDate,
        businessDays,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl ?? null,
        status: LeaveStatus.PENDING,
      },
    });

    const notificationData = {
      type: NotificationType.APPROVAL,
      title: 'Nueva solicitud de ausencia',
      message: `${user.name} solicitó ${businessDays} día(s) hábiles de ${this.humanType(dto.type)}`,
      leaveRequestId: leave.leaveRequestId,
      leaveType: dto.type,
      businessDays,
      startDate: leave.startDate,
      endDate: leave.endDate,
      createdAt: new Date(),
    };

    await this.socketGateway.notifyLeader(
      leaderId,
      'leave_request_received',
      notificationData,
    );

    await this.prisma.notification.create({
      data: {
        userId: leaderId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
      },
    });

    return leave;
  }

  /**
   *
   * Saldo = (dias devengados desde ingreso) - (dias ya aprobados este ciclo)
   * Devengados = 15 dias habiles por año completo trabajando, proporcional a
   * los meses. Fuente de verdad: se calcula, no se guarda
   */
  public async calculateVacationBalance(
    userId: string,
    startDate: Date | null,
  ) {
    if (!startDate) {
      return { accrued: 0, taken: 0, available: 0, pending: 0 };
    }

    const now = new Date();
    const monthsWorked =
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth());

    const accrued = Math.floor((monthsWorked * VACATIONS_DAYS_PER_YEAR) / 12);

    const approvedAgg = await this.prisma.leaveRequest.aggregate({
      where: {
        userId,
        type: LeaveType.VACACIONES,
        status: LeaveStatus.APPROVED,
      },
      _sum: { businessDays: true },
    });

    const taken = approvedAgg._sum.businessDays ?? 0;

    const pendingAgg = await this.prisma.leaveRequest.aggregate({
      where: {
        userId,
        type: LeaveType.VACACIONES,
        status: LeaveStatus.PENDING,
      },
      _sum: { businessDays: true },
    });

    const pending = pendingAgg._sum.businessDays ?? 0;

    return {
      accrued,
      taken,
      pending,
      available: accrued - taken,
    };
  }

  public async getMyBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { startDate: true },
    });

    return this.calculateVacationBalance(userId, user?.startDate ?? null);
  }

  public async findMyRequests(userId: string, query: LeaveQueryDto) {
    const where: any = { userId };

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.year) {
      const year = parseInt(query.year);
      where.startDate = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 32, 23, 59, 59),
      };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        leader: { select: { name: true, avatarUrl: true } },
      },
    });
  }

  public async findTeamRequests(leaderId: string, query: LeaveQueryDto) {
    const where: any = { leaderId };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.year) {
      const year = parseInt(query.year);
      where.startDate = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
            position: true,
            department: true,
          },
        },
      },
    });
  }

  public async findOne(leaveRequestId: string, userId: string) {
    const record = await this.prisma.leaveRequest.findUnique({
      where: { leaveRequestId },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        leader: { select: { name: true, email: true, avatarUrl: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Solicitud de ausencia no encontrada');
    }

    if (record.userId !== userId && record.leaderId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta solicitud');
    }

    return record;
  }

  public async review(record: LeaveRequest, dto: ReviewLeaveDto) {
    const updated = await this.prisma.leaveRequest.update({
      where: { leaveRequestId: record.leaveRequestId },
      data: {
        status: dto.status,
        comment: dto.comment,
        reviewedAt: new Date(),
      },
    });

    const isApproved = dto.status === LeaveStatus.APPROVED;
    const startStr = record.startDate.toLocaleDateString('es-CO');
    const endStr = record.endDate.toLocaleDateString('es-CO');

    const notificationData = {
      type: isApproved ? NotificationType.APPROVAL : NotificationType.REJECTION,
      title: isApproved ? 'Ausencia aprobada' : 'Ausencia rechazada',
      message: isApproved
        ? `Tu ausencia del ${startStr} al ${endStr} fue aprobada`
        : `Tu ausencia del ${startStr} al ${endStr} fue rechazada${dto.comment ? `. Motivo: ${dto.comment}` : ''}`,
      leaveRequestId: record.leaveRequestId,
      status: dto.status,
      reviewedAt: updated.reviewedAt,
      comment: dto.comment ?? null,
    };

    await this.socketGateway.notifyEmployee(
      record.userId,
      isApproved ? 'leave_request_approved' : 'leave_request_rejected',
      notificationData,
    );

    await this.prisma.notification.create({
      data: {
        userId: record.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
      },
    });

    return updated;
  }

  public async cancel(leaveRequestId: string, userId: string) {
    const record = await this.prisma.leaveRequest.findUnique({
      where: { leaveRequestId },
    });

    if (!record) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (record.userId !== userId) {
      throw new ForbiddenException(
        'Solo puedes cancelar tus propias solicitudes',
      );
    }

    if (record.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Solo puedes cancelar solicitudes pendientes',
      );
    }

    return this.prisma.leaveRequest.update({
      where: { leaveRequestId },
      data: {
        status: LeaveStatus.CANCELLED,
      },
    });
  }

  private humanType(type: LeaveType): string {
    const map: Record<LeaveType, string> = {
      VACACIONES: 'vacaciones',
      INCAPACIDAD_EPS: 'incapacidad (EPS)',
      INCAPACIDAD_ARL: 'incapacidad (ARL)',
      LICENCIA_MATERNIDAD: 'licencia de maternidad',
      LICENCIA_PATERNIDAD: 'licencia de paternidad',
      LICENCIA_LUTO: 'licencia por luto',
      LICENCIA_MATRIMONIO: 'licencia por matrimonio',
      PERMISO_REMUNERADO: 'permiso remunerado',
      PERMISO_NO_REMUNERADO: 'permiso no remunerado',
      CALAMIDAD_DOMESTICA: 'calamidad doméstica',
      OTRO: 'ausencia',
    };

    return map[type] ?? 'ausencia';
  }
}
