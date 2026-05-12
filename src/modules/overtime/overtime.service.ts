import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateOvertimeDto,
  OvertimeRequestInputDto,
} from './dto/create-overtime.dto';
import { ReviewOvertimeDto } from './dto/review-overtime.dto';
import { OvertimeQueryDto } from './dto/overtime-query.dto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { OvertimeStatus, Role, NotificationType } from 'generated/prisma/enums';
import { OvertimeRequest } from 'generated/prisma/browser';
import { PointsGateway } from '../points/gateway/points.gateway';

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly pointsGateway: PointsGateway,
  ) {}

  async create(userId: string, dto: CreateOvertimeDto) {
    // 1. Cargar usuario y verificar que tiene líder asignado
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { leaderId: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.leaderId) {
      throw new BadRequestException(
        'No tienes un líder asignado. Contacta a RRHH.',
      );
    }

    const isBatch = !!(dto.requests && dto.requests.length > 0);
    const entries: OvertimeRequestInputDto[] = isBatch
      ? dto.requests!
      : dto.date && dto.startTime && dto.endTime && dto.description
        ? [
            {
              date: dto.date,
              startTime: dto.startTime,
              endTime: dto.endTime,
              description: dto.description,
            },
          ]
        : [];

    if (!entries.length) {
      throw new BadRequestException(
        'Debes enviar al menos una solicitud en requests o el payload individual',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const preparedEntries = entries.map((entry, idx) => {
      const [year, month, day] = entry.date.split('-').map(Number);

      const requestDate = new Date(year, month - 1, day);

      requestDate.setHours(0, 0, 0, 0);
      const startTime = new Date(`${entry.date}T${entry.startTime}:00`);
      const endTime = new Date(`${entry.date}T${entry.endTime}:00`);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new BadRequestException(
          `Formato de fecha u hora inválido en requests[${idx}]`,
        );
      }

      if (endTime <= startTime) {
        throw new BadRequestException(
          `La hora de fin debe ser posterior a la hora de inicio en requests[${idx}]`,
        );
      }

      const totalHours =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      if (totalHours < 0.5) {
        throw new BadRequestException(`El mínimo registrable es 30 minutos`);
      }

      if (requestDate > today) {
        throw new BadRequestException(
          `No puedes registrar horas extra en fechas futuras`,
        );
      }

      const diffDays =
        (today.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 1) {
        throw new BadRequestException(
          `Solo puedes registrar horas extra de los últimos 24h`,
        );
      }

      return {
        ...entry,
        dateKey: entry.date,
        requestDate,
        startTime,
        endTime,
        totalHours,
      };
    });

    const dateKeys = Array.from(
      new Set(preparedEntries.map((entry) => entry.dateKey)),
    );

    const existingActiveByDate = await Promise.all(
      dateKeys.map(async (dateKey) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const dayStart = new Date(year, month - 1, day);
        const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        const summary = await this.prisma.overtimeRequest.aggregate({
          where: {
            userId,
            status: { in: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED] },
            date: { gte: dayStart, lte: dayEnd },
          },
          _sum: { totalHours: true },
        });
        return [dateKey, summary._sum.totalHours ?? 0] as const;
      }),
    );

    const requestedByDate = preparedEntries.reduce(
      (acc, entry) => {
        const key = entry.dateKey;
        acc[key] = (acc[key] ?? 0) + entry.totalHours;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [dateKey, existingHours] of existingActiveByDate) {
      const requestedHours = requestedByDate[dateKey] ?? 0;
      if (existingHours + requestedHours > 8) {
        throw new BadRequestException(
          `Excedes el máximo de 8h para ${dateKey}. Ya tienes ${existingHours}h activas y estás solicitando ${requestedHours}h.`,
        );
      }
    }

    const requestedByMonth = preparedEntries.reduce(
      (acc, entry) => {
        const monthKey = `${entry.requestDate.getFullYear()}-${entry.requestDate.getMonth()}`;
        acc[monthKey] = (acc[monthKey] ?? 0) + entry.totalHours;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const monthKey of Object.keys(requestedByMonth)) {
      const [yearStr, monthIndexStr] = monthKey.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthIndexStr);
      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

      const monthlySummary = await this.prisma.overtimeRequest.aggregate({
        where: {
          userId,
          status: OvertimeStatus.APPROVED,
          date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
        _sum: { totalHours: true },
      });

      const approvedHours = monthlySummary._sum.totalHours ?? 0;
      const requestedHours = requestedByMonth[monthKey];

      if (approvedHours + requestedHours > 50) {
        throw new BadRequestException(
          `Excedes el límite legal de 50 horas extra mensuales. Tienes ${approvedHours}h aprobadas en ${year}-${monthIndex + 1} y estás solicitando ${requestedHours}h.`,
        );
      }
    }

    const overtimes = await this.prisma.$transaction(
      preparedEntries.map((entry) =>
        this.prisma.overtimeRequest.create({
          data: {
            userId,
            leaderId: user.leaderId!,
            date: entry.requestDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            totalHours: Number(entry.totalHours.toFixed(2)),
            description: entry.description,
            status: OvertimeStatus.PENDING,
          },
        }),
      ),
    );

    const totalHoursRequested = overtimes.reduce(
      (sum, overtime) => sum + overtime.totalHours,
      0,
    );

    const notificationData = {
      type: NotificationType.OVERTIME_REQUEST,
      title: 'Nueva solicitud de horas extra',
      message: `${user.name} solicitó ${totalHoursRequested}h extra en ${overtimes.length} solicitud(es)`,
      requestsCount: overtimes.length,
      totalHours: totalHoursRequested,
      requests: overtimes.map((overtime) => ({
        overtimeRequestId: overtime.overtimeRequestId,
        date: overtime.date,
        startTime: overtime.startTime,
        endTime: overtime.endTime,
        totalHours: overtime.totalHours,
      })),
      createdAt: new Date(),
    };

    await this.pointsGateway.notifyLeader(
      user.leaderId,
      'overtime_request_received',
      notificationData,
    );

    await this.prisma.notification.create({
      data: {
        userId: user.leaderId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
      },
    });

    // 8. Notificar al líder por email
    // try {
    //   await this.emailService.sendInvite({
    //     userId: user.leaderId,
    //     title: 'Nueva solicitud de horas extra',
    //     message: `${user.name} ha solicitado ${totalHours}h extra para el ${dto.date}`,
    //     type: 'OVERTIME_REQUEST',
    //   });
    // } catch (error) {
    //   // La notificación no debe revertir la creación
    //   console.error('Error al enviar notificación al líder:', error);
    // }

    return isBatch ? overtimes : overtimes[0];
  }

  async findMyRequests(userId: string, query: OvertimeQueryDto) {
    const where: any = { userId };

    if (query.year && query.month) {
      const year = parseInt(query.year);
      const month = parseInt(query.month);
      where.date = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      };
    }

    return this.prisma.overtimeRequest.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        overtimeRequestId: true,
        date: true,
        startTime: true,
        endTime: true,
        totalHours: true,
        description: true,
        status: true,
        comment: true,
        createdAt: true,
        reviewedAt: true,
        leader: {
          select: { name: true, avatarUrl: true },
        },
      },
    });
  }

  async findTeamRequests(leaderId: string, query: OvertimeQueryDto) {
    const where: any = { leaderId };

    if (query.year && query.month) {
      const year = parseInt(query.year);
      const month = parseInt(query.month);
      where.date = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      };
    }

    if (query.employeeId) {
      where.userId = query.employeeId;
    }

    return this.prisma.overtimeRequest.findMany({
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

  async findOne(overtimeRequestId: string, userId: string) {
    const record = await this.prisma.overtimeRequest.findUnique({
      where: { overtimeRequestId },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        leader: { select: { name: true, email: true, avatarUrl: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('Solicitud de horas extra no encontrada');
    }

    // Solo el empleado dueño o el líder asignado pueden verla
    if (record.userId !== userId && record.leaderId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta solicitud');
    }

    return record;
  }

  async review(record: OvertimeRequest, dto: ReviewOvertimeDto) {
    // La validación de status PENDING y ownership ya la hizo el guard
    const updated = await this.prisma.overtimeRequest.update({
      where: { overtimeRequestId: record.overtimeRequestId },
      data: {
        status: dto.status,
        comment: dto.comment ?? null,
        reviewedAt: new Date(),
      },
    });

    const isApproved = dto.status === OvertimeStatus.APPROVED;
    const dateStr = record.date.toLocaleDateString('es-CO');
    const notificationData = {
      type: isApproved
        ? NotificationType.OVERTIME_APPROVED
        : NotificationType.OVERTIME_REJECTED,
      title: isApproved ? 'Horas extra aprobadas' : 'Horas extra rechazadas',
      message: isApproved
        ? `Tus ${record.totalHours}h extra del ${dateStr} fueron aprobadas`
        : `Tus horas extra del ${dateStr} fueron rechazadas${dto.comment ? `. Motivo: ${dto.comment}` : ''}`,
      overtimeRequestId: record.overtimeRequestId,
      status: dto.status,
      reviewedAt: updated.reviewedAt,
      comment: dto.comment ?? null,
    };

    await this.pointsGateway.notifyEmployee(
      record.userId,
      isApproved ? 'overtime_request_approved' : 'overtime_request_rejected',
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

    // Notificar al empleado por email
    // try {
    //   await this.emailService.sendInvite({
    //     userId: record.userId,
    //     title: isApproved ? 'Horas extra aprobadas' : 'Horas extra rechazadas',
    //     message: isApproved
    //       ? `Tus ${record.totalHours}h extra del ${dateStr} fueron aprobadas`
    //       : `Tus horas extra del ${dateStr} fueron rechazadas. Motivo: ${dto.comment}`,
    //     type: isApproved ? 'OVERTIME_APPROVED' : 'OVERTIME_REJECTED',
    //   });
    // } catch (error) {
    //   console.error('Error al enviar notificación al empleado:', error);
    // }

    return updated;
  }

  async getSummary(userId: string, role: Role, query: OvertimeQueryDto) {
    const year = query.year ? parseInt(query.year) : new Date().getFullYear();
    const month = query.month
      ? parseInt(query.month)
      : new Date().getMonth() + 1;

    const where: any = {
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      },
    };

    where.userId = userId;

    // if (role === Role.EMPLOYEE) {
    //   where.userId = userId;
    // } else {
    //   // LEADER o MANAGER ven su equipo
    //   where.leaderId = userId;
    //   if (query.employeeId) {
    //     where.userId = query.employeeId;
    //   }
    // }

    const records = await this.prisma.overtimeRequest.findMany({
      where,
      select: {
        overtimeRequestId: true,
        date: true,
        totalHours: true,
        status: true,
        userId: true,
        description: true,
      },
      orderBy: { date: 'asc' },
    });

    // Agrupar por día para el calendario
    const grouped = records.reduce(
      (acc, record) => {
        const key = record.date.toISOString().split('T')[0];
        if (!acc[key]) {
          acc[key] = { date: key, totalHours: 0, entries: [] };
        }
        acc[key].totalHours += record.totalHours;
        acc[key].entries.push(record);
        return acc;
      },
      {} as Record<
        string,
        { date: string; totalHours: number; entries: any[] }
      >,
    );

    // Resumen mensual
    const totalApproved = records
      .filter((r) => r.status === OvertimeStatus.APPROVED)
      .reduce((s, r) => s + r.totalHours, 0);

    const totalPending = records
      .filter((r) => r.status === OvertimeStatus.PENDING)
      .reduce((s, r) => s + r.totalHours, 0);

    const totalRejected = records
      .filter((r) => r.status === OvertimeStatus.REJECTED)
      .reduce((s, r) => s + r.totalHours, 0);

    const totalHours = records.reduce((s, r) => s + r.totalHours, 0);

    return {
      year,
      month,
      totalApproved,
      totalPending,
      totalRejected,
      totalHours,
      days: Object.values(grouped),
    };
  }
}
