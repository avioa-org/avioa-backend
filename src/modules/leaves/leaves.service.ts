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
import { countBusinessDays } from './helpers/business-days.helper';
import {
  LeaveStatus,
  LeaveType,
  NotificationType,
  Role,
} from 'generated/prisma/enums';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { LeaveRequest } from 'generated/prisma/browser';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import {
  BulkMigrateVacationsDto,
  HistoricalVacationEntryDto,
} from './dto/bulk-migration-vacations.dto';
import { ValidateCompensatedLeaveDto } from './dto/validate-compensated-leave.dto';
import { renderAccountantCompensatedApprovedEmail } from 'src/common/templates/render-accountant-compensated-approved-email';
import { renderLeaderCompensatedPendingEmail } from 'src/common/templates/render-leader-compensated-pending-email';
import { renderEmployeeCompensatedRejectedEmail } from 'src/common/templates/render-employee-compensated-rejected-email';
import { renderHRCompensatedPendingEmail } from 'src/common/templates/render-hr-compensated-pending-email';

const VACATIONS_DAYS_PER_YEAR = 15;
const MIN_VACATIONS_DAYS_PER_YEAR = -15;

export interface EntryResult {
  userId: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
}

export const HISTORICAL_MIGRATION_TAG = '[MIGRACION_HISTORICA_VACACIONES_2026]';

function parseHHmm(t: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function computeTotalHours(
  startTime?: string | null,
  endTime?: string | null,
): number | null {
  if (!startTime || !endTime) return null;
  const s = parseHHmm(startTime);
  const e = parseHHmm(endTime);
  if (s === null || e === null || e <= s) return null;
  return Math.round(((e - s) / 60) * 100) / 100;
}

function enrichLeave<
  T extends { startTime?: string | null; endTime?: string | null },
>(leave: T) {
  const totalHours = computeTotalHours(leave.startTime, leave.endTime);
  return {
    ...leave,
    isPartialDay: totalHours !== null,
    totalHours,
  };
}

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
      select: {
        leaderId: true,
        name: true,
        startDate: true,
        vacationDaysAdjustment: true,
      },
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

    const esCompensada =
      dto.type === 'VACACIONES' ? (dto.esCompensada ?? false) : false;

    if (dto.esCompensada && dto.type !== 'VACACIONES') {
      throw new BadRequestException(
        'Solo las vacaciones pueden marcarse como compensadas',
      );
    }

    let startDate: Date;
    let endDate: Date;
    let businessDays: number;

    if (esCompensada) {
      if (!dto.compensatedDays || dto.compensatedDays < 1) {
        throw new BadRequestException(
          'Debes indicar cuántos días deseas compensar',
        );
      }

      businessDays = dto.compensatedDays;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = today;
    } else {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          'Debes indicar las fechas de inicio y fin',
        );
      }

      const [ys, ms, ds] = dto.startDate.split('-').map(Number);
      const [ye, me, de] = dto.endDate.split('-').map(Number);
      startDate = new Date(ys, ms - 1, ds);
      endDate = new Date(ye, me - 1, de);
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

      businessDays = countBusinessDays(startDate, endDate);

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
    }

    const hasHours = dto.startTime !== undefined || dto.endTime !== undefined;

    if (hasHours) {
      if (dto.type === LeaveType.VACACIONES) {
        throw new BadRequestException(
          'Las vacaciones no se registran por horas',
        );
      }

      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'Debes indicar hora de inicio y hora de fin',
        );
      }

      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la hora de inicio',
        );
      }

      if (dto.startDate !== dto.endDate) {
        throw new BadRequestException(
          'Una ausencia por horas debe ser en un solo día',
        );
      }
    }

    if (dto.type === LeaveType.VACACIONES) {
      const balance = await this.calculateVacationBalance(
        userId,
        user.startDate,
        user.vacationDaysAdjustment,
      );

      // calculamos como quedaria el saldo
      // despues de esta nueva solicitud
      //ejemplo
      // saldo proyectado = -10
      // solicitud = 4
      // nuevo saldo = -14
      // se permite porque no supera -15
      const projectedBalance = balance.projectedAvailable - businessDays;

      if (projectedBalance < MIN_VACATIONS_DAYS_PER_YEAR) {
        throw new BadRequestException(
          `La solicitud supera el límite permitido de ${MIN_VACATIONS_DAYS_PER_YEAR} días de vacaciones. ` +
            `Saldo actual: ${balance.available} días, ` +
            `solicitudes pendientes: ${balance.pending} días, ` +
            `saldo proyectado: ${balance.projectedAvailable} días, ` +
            `solicitudes: ${businessDays} días.`,
        );
      }
    }

    const initialStatus = esCompensada
      ? LeaveStatus.PENDING_HR_VALIDATION
      : LeaveStatus.PENDING;

    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId,
        leaderId,
        type: dto.type,
        startDate,
        endDate,
        businessDays,
        startTime: hasHours ? dto.startTime : null,
        endTime: hasHours ? dto.endTime : null,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl ?? null,
        status: initialStatus,
        esCompensada,
        // externalApprovalRef: dto.externalApprovalRef ?? null,
        // externalApprovedAt: dto.externalApprovedAt
        //   ? new Date(dto.externalApprovedAt)
        //   : null,
      },
    });

    if (esCompensada) {
      await this.notifyHRNewCompensated(leave, user, businessDays);
    } else {
      await this.notifyLeaderNewLeave(leave, user, businessDays, leaderId);
    }

    // const notificationData = {
    //   type: NotificationType.LEAVE_REQUEST_RECEIVED,
    //   title: 'Nueva solicitud de ausencia',
    //   message: `${user.name} solicitó ${businessDays} día(s) hábiles de ${this.humanType(dto.type)}`,
    //   leaveRequestId: leave.leaveRequestId,
    //   leaveType: dto.type,
    //   businessDays,
    //   startDate: leave.startDate,
    //   endDate: leave.endDate,
    //   createdAt: new Date(),
    //   esCompensada,
    //   notificationId: '',
    // };

    // const notificationCreate = await this.prisma.$transaction(async (tx) => {
    //   return await this.prisma.notification.create({
    //     data: {
    //       userId: leaderId,
    //       title: notificationData.title,
    //       message: notificationData.message,
    //       type: notificationData.type as NotificationType,
    //     },
    //   });
    // });

    // notificationData.notificationId = notificationCreate.notificationId;

    // await this.socketGateway.notifyLeader(
    //   leaderId,
    //   'leave_request_received',
    //   notificationData,
    // );

    return leave;
  }

  private async notifyHRNewCompensated(
    leave: LeaveRequest,
    user: { name: string },
    businessDays: number,
  ) {
    const hrUsers = await this.prisma.user.findMany({
      where: {
        role: Role.RRHH,
        isLeader: true,
      },
      select: { userId: true, email: true },
    });

    if (hrUsers.length === 0) {
      this.logger.warn(
        'No hay usuarios RRHH+isLeader para notificar compensada',
      );
      return;
    }

    const userIds = hrUsers.map((h) => h.userId);

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: 'Nueva solicitud de vacaciones compensadas',
        message: `${user.name} solicitó ${businessDays} día(s) compensados. Requiere tu validación.`,
        type: NotificationType.COMPENSATED_LEAVE_PENDING_HR,
      })),
    });

    await this.socketGateway.notifyUsers(
      userIds,
      'compensated_leave_pending_hr',
      {
        leaveRequestId: leave.leaveRequestId,
        employeeName: user.name,
        businessDays,
        compensatedDays: businessDays,
        requestedAt: leave.createdAt,
        externalApprovalRef: leave.externalApprovalRef,
      },
    );

    await this.emailService.send(
      hrUsers.map((h) => h.email as string),
      `Validación pendiente: vacaciones compensadas de ${user.name}`,
      renderHRCompensatedPendingEmail({
        leave,
        employeeName: user.name,
        businessDays,
      }),
    );
  }

  private async notifyLeaderNewLeave(
    leave: LeaveRequest,
    user: { name: string },
    businessDays: number,
    leaderId: string,
  ) {
    const isPartialDay = !!leave.startTime && !!leave.endTime;

    const timeRange = isPartialDay
      ? `${leave.startTime} - ${leave.endTime}`
      : '';

    const notificationData = {
      type: NotificationType.LEAVE_REQUEST_RECEIVED,
      title: isPartialDay
        ? 'Nueva solicitud de ausencia parcial'
        : 'Nueva solicitud de ausencia',
      message: isPartialDay
        ? `${user.name} solicitó ${this.humanType(leave.type)} el ${leave.startDate.toLocaleDateString('es-CO')}${timeRange}`
        : `${user.name} solicitó ${businessDays} día(s) hábiles de ${this.humanType(leave.type)}`,
      leaveRequestId: leave.leaveRequestId,
      leaveType: leave.type,
      businessDays,
      startDate: leave.startDate,
      endDate: leave.endDate,
      startTime: leave.startTime,
      endTime: leave.endTime,
      isPartialDay,
      createdAt: new Date(),
      esCompensada: false,
      notificationId: '',
    };

    const notificationCreate = await this.prisma.notification.create({
      data: {
        userId: leaderId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type as NotificationType,
      },
    });

    notificationData.notificationId = notificationCreate.notificationId;

    await this.socketGateway.notifyLeader(
      leaderId,
      'leave_request_received',
      notificationData,
    );
  }

  public async validateByHR(
    leaveRequestId: string,
    hrUserId: string,
    dto: ValidateCompensatedLeaveDto,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { leaveRequestId },
      include: {
        user: { select: { userId: true, name: true, email: true } },
        leader: { select: { userId: true, name: true, email: true } },
      },
    });

    if (!leave) throw new NotFoundException('Solicitud no encontrada');
    if (!leave.esCompensada) {
      throw new BadRequestException('Esta solicitud no es compensada');
    }
    if (leave.status !== LeaveStatus.PENDING_HR_VALIDATION) {
      throw new BadRequestException(
        `La solicitud no está pendiente de validación de GH (estado: ${leave.status})`,
      );
    }

    if (dto.action === 'REJECT') {
      const rejected = await this.prisma.leaveRequest.update({
        where: { leaveRequestId },
        data: {
          status: LeaveStatus.REJECTED,
          hrValidatedById: hrUserId,
          hrValidatedAt: new Date(),
          hrComment: dto.comment!,
          reviewedAt: new Date(),
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: leave.userId,
          title: 'Vacaciones compensadas rechazadas',
          message: `Tu solicitud de vacaciones compensadas fue rechazada por GH. Motivo: ${dto.comment}`,
          type: NotificationType.LEAVE_REQUEST_REJECTED,
        },
      });

      await this.socketGateway.notifyEmployee(
        leave.userId,
        'compensated_leave_rejected_by_hr',
        {
          leaveRequestId,
          comment: dto.comment,
          reviewedAt: rejected.reviewedAt,
        },
      );

      if (leave.user.email) {
        this.logger.log(
          `Vacaciones compensadas rechazadas: ${leave.user.email}`,
        );
        await this.emailService.send(
          leave.user.email,
          'Tu solicitud de vacaciones compensadas fue rechazada',
          renderEmployeeCompensatedRejectedEmail({
            leave: rejected,
            comment: dto.comment!,
          }),
        );
      }

      return rejected;
    }

    const validated = await this.prisma.leaveRequest.update({
      where: { leaveRequestId },
      data: {
        status: LeaveStatus.PENDING,
        hrValidatedById: hrUserId,
        hrValidatedAt: new Date(),
        hrComment: dto.comment ?? null,
      },
    });

    await this.notifyLeaderCompensatedValidated(leave, validated);

    await this.prisma.notification.create({
      data: {
        userId: leave.userId,
        title: 'Vacaciones compensadas validadas por GH',
        message:
          'Tu solicitud fue validada por GH y está en revisión de tu líder.',
        type: NotificationType.LEAVE_REQUEST_RECEIVED,
      },
    });

    await this.socketGateway.notifyEmployee(
      leave.userId,
      'compensated_leave_validated_by_hr',
      { leaveRequestId },
    );

    return validated;
  }

  private async notifyLeaderCompensatedValidated(
    leave: LeaveRequest & {
      user: { name: string; email: string | null };
      leader: { userId: string; name: string; email: string | null };
    },
    updated: LeaveRequest,
  ) {
    const message = `${leave.user.name} solicitó ${leave.businessDays} día(s) de vacaciones compensadas (validadas por GH). Requiere tu aprobación.`;

    await this.prisma.notification.create({
      data: {
        userId: leave.leaderId,
        title: 'Vacaciones compensadas pendientes de tu aprobación',
        message,
        type: NotificationType.LEAVE_REQUEST_RECEIVED,
      },
    });

    await this.socketGateway.notifyLeader(
      leave.leaderId,
      'compensated_leave_pending_leader',
      {
        leaveRequestId: updated.leaveRequestId,
        esCompensada: true,
        businessDays: updated.businessDays,
        startDate: updated.startDate,
        endDate: updated.endDate,
        employeeName: leave.user.name,
        hrValidatedAt: updated.hrValidatedAt,
      },
    );

    if (leave.leader.email) {
      await this.emailService.send(
        leave.leader.email,
        `Aprobación pendiente: vacaciones compensadas de ${leave.user.name}`,
        renderLeaderCompensatedPendingEmail({
          leave: updated,
          employeeName: leave.user.name,
        }),
      );
    }
  }

  public async calculateVacationBalance(
    userId: string,
    startDate: Date | null,
    adjustmentInput?: number,
  ) {
    const adjustment =
      adjustmentInput ??
      (
        await this.prisma.user.findUnique({
          where: { userId },
          select: { vacationDaysAdjustment: true },
        })
      )?.vacationDaysAdjustment ??
      0;

    if (!startDate) {
      return {
        accrued: adjustment,
        taken: 0,
        pending: 0,
        available: adjustment,
        projectedAvailable: adjustment,
        adjustment,
      };
    }

    const now = new Date();

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const current = new Date(now);
    current.setHours(0, 0, 0, 0);

    if (start > current) {
      return {
        accrued: adjustment,
        taken: 0,
        pending: 0,
        available: adjustment,
        projectedAvailable: adjustment,
        adjustment,
      };
    }

    // calculo de los meses completos trabajados
    // ejemplo:
    // fecha ingreso: 2025-01-15
    // fecha actual: 2026-08-19
    // monthsWorked = 19
    let monthsWorked =
      (current.getFullYear() - start.getFullYear()) * 12 +
      (current.getMonth() - start.getMonth());

    // si todavia no ha llegado al mismo dia del mes
    // todavia no contamos ese ultimo mes
    if (current.getDate() < start.getDate()) {
      monthsWorked--;
    }

    monthsWorked = Math.max(0, monthsWorked);

    // 15 dias habiles por año
    // se acumulan proporcionalmente por meses + el ajuste manual de RRHH.
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const daysWorked = Math.floor(
      (current.getTime() - start.getTime()) / MS_PER_DAY,
    );

    // const calculatedAccrued =
    //   Math.floor(((daysWorked * VACATIONS_DAYS_PER_YEAR) / 360) * 100) / 100;

    const calculatedAccrued = Math.floor(
      (daysWorked * VACATIONS_DAYS_PER_YEAR) / 360,
    );
    // const accrued = Math.floor(calculatedAccrued + adjustment);
    const accrued = Math.floor(calculatedAccrued);

    // vacaciones aprobadas
    // se consideran todas las vacaciones aprobadas
    // historicamente desde la fecha de ingreso
    const approvedAgg = await this.prisma.leaveRequest.aggregate({
      where: {
        userId,
        type: LeaveType.VACACIONES,
        status: LeaveStatus.APPROVED,
      },
      _sum: { businessDays: true },
    });

    const taken = approvedAgg._sum.businessDays ?? 0;

    // vacaciones pendientes
    // no han sido descontadas definitivamente
    // pero debemos reservarlas para evitar
    // que el empleado puede solicitar de mas
    const pendingAgg = await this.prisma.leaveRequest.aggregate({
      where: {
        userId,
        type: LeaveType.VACACIONES,
        status: LeaveStatus.PENDING,
      },
      _sum: { businessDays: true },
    });

    const pending = pendingAgg._sum.businessDays ?? 0;

    // saldo real
    // lo generado menos lo aprobado
    // puede ser positivo o negativo
    // ejemplo:
    // accrued = 30
    // taken = 35
    // available = -5
    const available = accrued + adjustment - taken;

    // saldo proyectado
    // se tienen en cuenta las solicitudes pendientes
    // ejemplo
    // available = -5
    // pending = 3
    // projectedAvailable = - 8
    const projectedAvailable = available - pending;

    return {
      accrued,
      taken,
      pending,
      available,
      projectedAvailable,
      adjustment,
    };
  }

  public async getMyBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { startDate: true, vacationDaysAdjustment: true },
    });

    const balance = await this.calculateVacationBalance(
      userId,
      user?.startDate ?? null,
      user?.vacationDaysAdjustment ?? 0,
    );
    return balance;
  }

  public async findMyRequests(userId: string, query: LeaveQueryDto) {
    const where: any = {
      userId,
      NOT: { reason: { contains: 'MIGRACION_HISTORICA_VACACIONES_2026' } },
    };

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.year) {
      const year = parseInt(query.year);
      where.startDate = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 32, 23, 59, 59),
      };
    }

    const rows = await this.prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        leader: { select: { name: true, avatarUrl: true } },
      },
    });

    // return this.prisma.leaveRequest.findMany({
    //   where,
    //   orderBy: { startDate: 'desc' },
    //   include: {
    //     leader: { select: { name: true, avatarUrl: true } },
    //   },
    // });

    return rows.map(enrichLeave);
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

    const rows = await this.prisma.leaveRequest.findMany({
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

    return rows.map(enrichLeave);
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

    return enrichLeave(record);
  }

  public async findPendingHRValidation() {
    return this.prisma.leaveRequest.findMany({
      where: {
        esCompensada: true,
        status: LeaveStatus.PENDING_HR_VALIDATION,
      },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            documentNumber: true,
            position: true,
            area: true,
          },
        },
        leader: { select: { userId: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async review(record: LeaveRequest, dto: ReviewLeaveDto) {
    if (record.esCompensada && !record.hrValidatedAt) {
      throw new BadRequestException(
        'Las vacaciones compensadas requieren validación previa de GH',
      );
    }

    // const updated = await this.prisma.leaveRequest.update({
    //   where: { leaveRequestId: record.leaveRequestId },
    //   data: {
    //     status: dto.status,
    //     comment: dto.comment,
    //     reviewedAt: new Date(),
    //   },
    // });

    const isApproved = dto.status === LeaveStatus.APPROVED;
    const startStr = record.startDate.toLocaleDateString('es-CO');
    const endStr = record.endDate.toLocaleDateString('es-CO');

    const { updated, notificationCreated } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { leaveRequestId: record.leaveRequestId },
          data: {
            status: dto.status,
            comment: dto.comment,
            reviewedAt: new Date(),
          },
        });

        const notificationCreated = await tx.notification.create({
          data: {
            userId: record.userId,
            title: isApproved ? 'Ausencia aprobada' : 'Ausencia rechazada',
            message: isApproved
              ? `Tu ausencia del ${startStr} al ${endStr} fue aprobada`
              : `Tu ausencia del ${startStr} al ${endStr} fue rechazada${
                  dto.comment ? `. Motivo: ${dto.comment}` : ''
                }`,
            type: isApproved
              ? NotificationType.LEAVE_REQUEST_APPROVED
              : NotificationType.LEAVE_REQUEST_REJECTED,
          },
        });

        return { updated, notificationCreated };
      },
    );

    // const notificationData = {
    //   type: isApproved
    //     ? NotificationType.LEAVE_REQUEST_APPROVED
    //     : NotificationType.LEAVE_REQUEST_REJECTED,
    //   title: isApproved ? 'Ausencia aprobada' : 'Ausencia rechazada',
    //   message: isApproved
    //     ? `Tu ausencia del ${startStr} al ${endStr} fue aprobada`
    //     : `Tu ausencia del ${startStr} al ${endStr} fue rechazada${dto.comment ? `. Motivo: ${dto.comment}` : ''}`,
    //   leaveRequestId: record.leaveRequestId,
    //   status: dto.status,
    //   reviewedAt: updated.reviewedAt,
    //   comment: dto.comment ?? null,
    //   notificationId: '',
    // };

    // const notificationCreated = await this.prisma.$transaction(async () => {
    //   return await this.prisma.notification.create({
    //     data: {
    //       userId: record.userId,
    //       title: notificationData.title,
    //       message: notificationData.message,
    //       type: notificationData.type as NotificationType,
    //     },
    //   });
    // });

    // notificationData.notificationId = notificationCreated.notificationId;

    // await this.socketGateway.notifyEmployee(
    //   record.userId,
    //   isApproved ? 'leave_request_approved' : 'leave_request_rejected',
    //   notificationData,
    // );

    await this.socketGateway.notifyEmployee(
      record.userId,
      isApproved ? 'leave_request_approved' : 'leave_request_rejected',
      {
        type: isApproved
          ? NotificationType.LEAVE_REQUEST_APPROVED
          : NotificationType.LEAVE_REQUEST_REJECTED,
        title: isApproved ? 'Ausencia aprobada' : 'Ausencia rechazada',
        message: isApproved
          ? `Tu ausencia del ${startStr} al ${endStr} fue aprobada`
          : `Tu ausencia del ${startStr} al ${endStr} fue rechazada${
              dto.comment ? `. Motivo: ${dto.comment}` : ''
            }`,
        leaveRequestId: record.leaveRequestId,
        status: dto.status,
        reviewedAt: updated.reviewedAt,
        comment: dto.comment ?? null,
        notificationId: notificationCreated.notificationId,
      },
    );

    if (record.esCompensada && isApproved) {
      try {
        await this.notifyAccountantByEmail(record, updated);
      } catch (err) {
        this.logger.error(
          `Error notificando a Contabilidad para ${record.leaveRequestId}: ${err}`,
        );
      }
    }

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

  public async getAllEmployeeBalances() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        userId: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        position: true,
        startDate: true,
        vacationDaysAdjustment: true,
        leaderId: true,
      },
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      users.map(async (u) => {
        const balance = await this.calculateVacationBalance(
          u.userId,
          u.startDate,
          u.vacationDaysAdjustment,
        );

        return {
          user: {
            userId: u.userId,
            name: u.name,
            email: u.email,
            avatarUrl: u.avatarUrl,
            department: u.department,
            position: u.position,
            startDate: u.startDate,
            leaderId: u.leaderId,
          },
          balance,
        };
      }),
    );

    return results;
  }

  public async findOneForHR(leaveRequestId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { leaveRequestId },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
            position: true,
            department: true,
            email: true,
          },
        },
        leader: {
          select: { name: true, avatarUrl: true, email: true },
        },
      },
    });

    if (!leave) throw new NotFoundException('Solicitud no encontrada');
    if (!leave.esCompensada) {
      throw new BadRequestException(
        'Esta solicitud no es de vacaciones compensadas',
      );
    }

    return leave;
  }

  public async updateUserVacationAdjustment(
    userId: string,
    vacationDaysAdjustment: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, startDate: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data: { vacationDaysAdjustment },
      select: {
        userId: true,
        name: true,
        email: true,
        vacationDaysAdjustment: true,
      },
    });

    const newBalance = await this.calculateVacationBalance(
      userId,
      user.startDate,
      vacationDaysAdjustment,
    );

    return {
      message: 'Ajuste de vacaciones actualizado correctamente',
      user: updatedUser,
      balance: newBalance,
    };
  }

  public async bulkMigrate(dto: BulkMigrateVacationsDto) {
    const results: EntryResult[] = [];

    for (const entry of dto.entries) {
      try {
        const result = await this.migrateOne(entry, dto.dryRun ?? false);
        results.push(result);
      } catch (err: any) {
        this.logger.error(
          `Error migrando userId=${entry.userId}: ${err.message}`,
          err.stack,
        );
        results.push({
          userId: entry.userId,
          status: 'error',
          message: err.message,
        });
      }
    }

    return {
      dryRun: dto.dryRun ?? false,
      total: dto.entries.length,
      ok: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error'),
      details: results,
    };
  }

  private async notifyAccountantByEmail(
    record: LeaveRequest,
    updated: LeaveRequest,
  ) {
    const accountants = await this.prisma.user.findMany({
      where: { role: Role.ACCOUNTING },
      select: { email: true },
    });

    if (accountants.length === 0) {
      this.logger.warn(
        `No hay usuarios ACCOUNTING para notificar la solicitud ${record.leaveRequestId}`,
      );
      return;
    }

    await this.emailService.send(
      accountants.map((a) => a.email as string),
      `Nómina: vacaciones compensadas aprobadas`,
      renderAccountantCompensatedApprovedEmail({ leave: updated }),
    );

    await this.prisma.leaveRequest.update({
      where: { leaveRequestId: record.leaveRequestId },
      data: { notifiedAccountingAt: new Date() },
    });
  }

  private async migrateOne(
    entry: HistoricalVacationEntryDto,
    dryRun: boolean,
  ): Promise<EntryResult> {
    const LOTE_TAG = 'lote-3-programados-rrhh';
    const already = await this.prisma.leaveRequest.findFirst({
      where: {
        userId: entry.userId,
        type: LeaveType.VACACIONES,
        reason: { contains: LOTE_TAG },
        status: entry.status,
      },
      select: { leaveRequestId: true },
    });

    if (already) {
      return {
        userId: entry.userId,
        status: 'skipped',
        message:
          'Ya existe un registro histórico (${already.leaveRequestId}); no se volvió a crear.',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { userId: entry.userId },
      select: { userId: true },
    });

    if (!user) {
      return {
        userId: entry.userId,
        status: 'error',
        message: 'userId no existe en la tabla User',
      };
    }

    if (dryRun) {
      return { userId: entry.userId, status: 'ok', message: 'dry-run: ok' };
    }

    await this.prisma.$transaction(async (tx) => {
      if (entry.businessDays > 0) {
        await tx.leaveRequest.create({
          data: {
            userId: entry.userId,
            leaderId: entry.leaderId,
            type: LeaveType.VACACIONES,
            startDate: new Date(entry.startDate),
            endDate: new Date(entry.endDate),
            businessDays: entry.businessDays,
            reason: `${entry.reason ?? 'Migración de saldo histórico de vacaciones'} ${HISTORICAL_MIGRATION_TAG}`,
            reviewedAt: new Date(),
            status: entry.status,
          },
        });
      }

      if (entry.newAdjustment !== 0) {
        await tx.user.update({
          where: { userId: entry.userId },
          data: { vacationDaysAdjustment: entry.newAdjustment },
        });
      }
    });

    return { userId: entry.userId, status: 'ok' };
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
      DILIGENCIA_PERSONAL: 'diligencia personal',
      OBLIGACION_COMO_ACUDIENTE:
        'permiso para asistir a obligaciones escolares como acudiente',
      CITA_MEDICA_PARTICULAR: 'cita médica particular',
      OTRO: 'ausencia',
      CITA_MEDICA_CON_ESPECIALISTA_EPS: 'cita médica con especialista (EPS)',
    };

    return map[type] ?? 'ausencia';
  }
}
