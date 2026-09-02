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
import { SocketGateway } from '../points/gateway/points.gateway';
import { envs } from 'src/config/env.config';

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly socketGateway: SocketGateway,
  ) {}

  async create(userId: string, dto: CreateOvertimeDto) {
    this.logger.debug(dto, 'create-overtime-dto');

    // 1. Cargar usuario y verificar que tiene líder asignado
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { leaderId: true, name: true, documentNumber: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const leaderId = dto.leaderId ? dto.leaderId : user?.leaderId;

    if (!leaderId) {
      throw new BadRequestException(
        'No tienes un lider asignado o no has seleccionado uno.',
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
      const requestDate = new Date(`${entry.date}T00:00:00-05:00`);
      const startTime = new Date(`${entry.date}T${entry.startTime}:00-05:00`);
      const endTime = new Date(`${entry.date}T${entry.endTime}:00-05:00`);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new BadRequestException(
          `Formato de fecha u hora inválido en requests[${idx}]`,
        );
      }

      // asumimo que si la hora de fin es menor o igual a la de inicio, cruza medianoche
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      const totalHours =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      if (totalHours < 0.5) {
        throw new BadRequestException(`El mínimo registrable es 30 minutos`);
      }

      if (requestDate.getTime() !== today.getTime()) {
        throw new BadRequestException(
          `Solo puedes registrar horas extra del dia actual.`,
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

    // verificar solapamiento

    for (let i = 0; i < preparedEntries.length; i++) {
      for (let j = i + 1; j < preparedEntries.length; j++) {
        const a = preparedEntries[i];
        const b = preparedEntries[j];

        if (this.hasOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
          throw new BadRequestException(
            `Las solicitudes ${i + 1} y ${j + 1} tienen horarios solapados.`,
          );
        }
      }
    }

    const dateRanges = preparedEntries.map((entry) => {
      const startDate = new Date(entry.requestDate); // fecha inicio
      const endDate = new Date(entry.endTime); // puede ser el dia siguiente
      return { startDate, endDate };
    });

    const minDate = new Date(
      Math.min(...dateRanges.map((r) => r.startDate.getTime())),
    );

    const maxDate = new Date(
      Math.max(...dateRanges.map((r) => r.endDate.getTime())),
    );
    maxDate.setHours(23, 59, 59, 999);

    const existingRequests = await this.prisma.overtimeRequest.findMany({
      where: {
        userId,
        status: { in: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED] },
        date: { gte: minDate, lte: maxDate },
      },
    });

    for (const entry of preparedEntries) {
      for (const existing of existingRequests) {
        const existingStart = existing.startTime;
        const existingEnd = existing.endTime;

        if (
          this.hasOverlap(
            entry.startTime,
            entry.endTime,
            existingStart,
            existingEnd,
          )
        ) {
          throw new BadRequestException(
            `Ya tienes una solicitud que se cruza con el horario ${entry.startTime.toLocaleTimeString()} - ${entry.endTime.toLocaleTimeString()}.`,
          );
        }
      }
    }

    const DAILY_LIMITS_HOURS = 8;

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
      if (existingHours + requestedHours > DAILY_LIMITS_HOURS) {
        throw new BadRequestException(
          `Excedes el máximo de ${DAILY_LIMITS_HOURS}h para ${dateKey}. Ya tienes ${existingHours}h activas y estás solicitando ${requestedHours}h.`,
        );
      }
    }

    const MONTHLY_LIMIT_HOURS = 50;

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

      if (approvedHours + requestedHours > MONTHLY_LIMIT_HOURS) {
        throw new BadRequestException(
          `Excedes el límite legal de ${MONTHLY_LIMIT_HOURS} horas extra mensuales. Tienes ${approvedHours}h aprobadas en ${year}-${monthIndex + 1} y estás solicitando ${requestedHours}h.`,
        );
      }
    }

    const overtimes = await this.prisma.$transaction(
      preparedEntries.map((entry) =>
        this.prisma.overtimeRequest.create({
          data: {
            userId,
            leaderId,
            date: entry.requestDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            totalHours: Number(entry.totalHours.toFixed(2)),
            description: entry.description,
            status: OvertimeStatus.PENDING,
          },
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true,
                position: true,
                department: true,
                documentNumber: true,
              },
            },
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
      requests: overtimes,
      createdAt: new Date(),
    };

    await this.socketGateway.notifyLeader(
      leaderId,
      'overtime_request_received',
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

  private async sendToN8N(
    overtime: OvertimeRequest,
    user: { name: string; documentNumber?: string },
  ) {
    if (!overtime) {
      throw new BadRequestException(
        'No se encontró el registro de horas extra para enviar a N8N',
      );
    }

    if (
      !(overtime.startTime instanceof Date) ||
      isNaN(overtime.startTime.getTime())
    ) {
      throw new BadRequestException(
        'La fecha de inicio de la hora extra no es válida',
      );
    }

    if (
      !(overtime.endTime instanceof Date) ||
      isNaN(overtime.endTime.getTime())
    ) {
      throw new BadRequestException(
        'La fecha de fin de la hora extra no es válida',
      );
    }

    const formatTime = (date: Date): string => {
      return `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}:00`;
    };

    const formatDate = (date: Date): string => {
      return `${date.getDate()}/${String(date.getMonth() + 1).padStart(
        2,
        '0',
      )}/${date.getFullYear()}`;
    };

    const inicio = formatTime(overtime.startTime);
    const final = formatTime(overtime.endTime);
    const descripcion = overtime.description ?? '';
    const id = `${user.documentNumber}-${formatDate(overtime.startTime)}`;

    const url = new URL(envs.N8N_OVERTIME_URL);

    url.searchParams.set('accion', 'aprobado');
    url.searchParams.set('id', id);
    url.searchParams.set('nombre', user.name);
    url.searchParams.set('inicio', inicio);
    url.searchParams.set('final', final);
    url.searchParams.set('desc', descripcion);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10_000);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Error al enviar la solicitud a N8N');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout comuncándose con n8n');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
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
      include: {
        user: {
          select: { name: true, documentNumber: true, isUserTest: true },
        },
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

    await this.socketGateway.notifyEmployee(
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

    // registrar en N8N si fue aprobado
    if (isApproved && !updated.user.isUserTest) {
      if (updated.user.documentNumber) {
        await this.sendToN8N(updated, {
          name: updated.user.name,
          documentNumber: updated.user.documentNumber || undefined,
        });
        this.logger.log(
          `Solicitud de horas extra enviada a N8N para ${updated.user.name} (${updated.user.documentNumber})`,
        );
      }
    }

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
        startTime: true,
        endTime: true,
        comment: true,
        status: true,
        userId: true,
        description: true,
        createdAt: true,
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

  private hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && endA > startB;
  }
}
