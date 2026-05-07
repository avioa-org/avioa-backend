import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { ReviewOvertimeDto } from './dto/review-overtime.dto';
import { OvertimeQueryDto } from './dto/overtime-query.dto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { OvertimeStatus, Role } from 'generated/prisma/enums';
import { OvertimeRequest } from 'generated/prisma/browser';

@Injectable()
export class OvertimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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

    // 2. Parsear fechas y horas
    const startTime = new Date(`${dto.date}T${dto.startTime}:00`);
    const endTime = new Date(`${dto.date}T${dto.endTime}:00`);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Formato de fecha u hora inválido');
    }

    if (endTime <= startTime) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    }

    // 3. Calcular totalHours
    const totalHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    if (totalHours < 0.5) {
      throw new BadRequestException('El mínimo registrable es 30 minutos');
    }

    if (totalHours > 8) {
      throw new BadRequestException(
        'No se pueden registrar más de 8 horas extra por día',
      );
    }

    // 4. Validar ventana de fechas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestDate = new Date(dto.date);
    requestDate.setHours(0, 0, 0, 0);

    if (requestDate > today) {
      throw new BadRequestException(
        'No puedes registrar horas extra en fechas futuras',
      );
    }

    const diffDays =
      (today.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > 5) {
      throw new BadRequestException(
        'Solo puedes registrar horas extra de los últimos 5 días',
      );
    }

    // 5. Verificar duplicado en la misma fecha
    const duplicate = await this.prisma.overtimeRequest.findFirst({
      where: {
        userId,
        date: requestDate,
        status: { in: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED] },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya tienes una solicitud activa para esta fecha',
      );
    }

    // 6. Validar límite mensual de 50h (normativa colombiana)
    const firstDayOfMonth = new Date(
      requestDate.getFullYear(),
      requestDate.getMonth(),
      1,
    );
    const lastDayOfMonth = new Date(
      requestDate.getFullYear(),
      requestDate.getMonth() + 1,
      0,
    );

    const monthlySummary = await this.prisma.overtimeRequest.aggregate({
      where: {
        userId,
        status: OvertimeStatus.APPROVED,
        date: { gte: firstDayOfMonth, lte: lastDayOfMonth },
      },
      _sum: { totalHours: true },
    });

    const horasAprobadas = monthlySummary._sum.totalHours ?? 0;

    if (horasAprobadas + totalHours > 50) {
      throw new BadRequestException(
        `Excedes el límite legal de 50 horas extra mensuales. Tienes ${horasAprobadas}h aprobadas este mes.`,
      );
    }

    // 7. Crear el registro
    const overtime = await this.prisma.overtimeRequest.create({
      data: {
        userId,
        leaderId: user.leaderId,
        date: requestDate,
        startTime,
        endTime,
        totalHours,
        description: dto.description,
        status: OvertimeStatus.PENDING,
      },
    });

    // 8. Notificar al líder
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

    return overtime;
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

    // Notificar al empleado
    // try {
    //   const isApproved = dto.status === OvertimeStatus.APPROVED;
    //   const dateStr = record.date.toLocaleDateString('es-CO');

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

    if (role === Role.EMPLOYEE) {
      where.userId = userId;
    } else {
      // LEADER o MANAGER ven su equipo
      where.leaderId = userId;
      if (query.employeeId) {
        where.userId = query.employeeId;
      }
    }

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

    return {
      year,
      month,
      totalApproved,
      totalPending,
      totalRejected,
      days: Object.values(grouped),
    };
  }
}
