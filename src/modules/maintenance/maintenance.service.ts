import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MaintenanceGateway } from './maintenance.gateway';
import { EvolutionApiService } from '../../infrastructure/evolution-api/evolution-api.service';
import { envs } from '../../config/env.config';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import {
  MaintenanceStatus,
  EquipmentStatus,
  MaintenanceRequestType,
  LoanStatus,
} from 'generated/prisma/enums';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MaintenanceGateway,
    private readonly evolutionApi: EvolutionApiService,
  ) {}

  // ===== HELPERS WHATSAPP =====
  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith('57')) cleaned = `57${cleaned}`;
    return cleaned;
  }

  private formatFecha(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private buildWhatsAppMessage(
    solicitante: { name: string; area?: string | null },
    equipment: { name: string; serialNumber?: string | null; category: string },
    reason: string,
    description?: string | null,
  ): string {
    const lineas = [
      '*NUEVA SOLICITUD DE MANTENIMIENTO*',
      '',
      `*Solicitante:* ${solicitante.name}`,
      solicitante.area ? `*Area:* ${solicitante.area}` : '',
      `*Equipo:* ${equipment.name}`,
      equipment.serialNumber ? `*Serial:* ${equipment.serialNumber}` : '',
      `*Categoria:* ${equipment.category}`,
      `*Motivo:* ${reason}`,
      description ? `*Detalles:* ${description}` : '',
      '',
      'Revisa el portal para gestionar la solicitud.',
    ];
    return lineas.filter(Boolean).join('\n');
  }

  // ===== BUSCAR ENCARGADO DE SOPORTE =====
  private async getSupportUser() {
    const soporte = await this.prisma.user.findUnique({
      where: { documentNumber: envs.SOPORTE_DOCUMENT_NUMBER },
      select: { userId: true, name: true, phone: true },
    });

    if (!soporte) {
      this.logger.error(
        `Encargado de soporte no encontrado (documentNumber: ${envs.SOPORTE_DOCUMENT_NUMBER})`,
      );
      throw new BadRequestException(
        'No se encontró un encargado de soporte técnico configurado. Contacta al administrador.',
      );
    }

    return soporte;
  }

  // ===== CREAR SOLICITUD =====
  async create(userId: string, dto: CreateMaintenanceDto) {
    // Validación condicional según el tipo
    if (dto.requestType === MaintenanceRequestType.EQUIPMENT) {
      if (!dto.equipmentId) {
        throw new BadRequestException(
          'Se requiere un equipo para solicitudes de tipo EQUIPMENT',
        );
      }
    }

    if (dto.requestType === MaintenanceRequestType.GENERAL) {
      if (!dto.locationId) {
        throw new BadRequestException(
          'Se requiere una ubicación para reportes generales',
        );
      }
    }

    // ===== Rama 1: EQUIPMENT =====
    let equipment: any = null;
    let location: any = null;
    let solicitante: any = null;

    if (dto.requestType === MaintenanceRequestType.EQUIPMENT) {
      equipment = await this.prisma.equipment.findUnique({
        where: { equipmentId: dto.equipmentId! },
      });

      if (!equipment) {
        throw new NotFoundException('Equipo no encontrado');
      }

      if (equipment.status === EquipmentStatus.MAINTENANCE) {
        throw new BadRequestException(
          'Este equipo ya se encuentra en mantenimiento',
        );
      }

      if (equipment.status === EquipmentStatus.LOANED) {
        const activeLoan = await this.prisma.equipmentLoan.findFirst({
          where: {
            equipmentId: equipment.equipmentId,
            status: LoanStatus.APPROVED,
          },
          select: { userId: true },
        });

        if (!activeLoan || activeLoan.userId !== userId) {
          throw new BadRequestException(
            'No puedes solicitar mantenimiento de un equipo que no tienes asignado',
          );
        }
      }
    }

    // ===== Rama 2: GENERAL =====
    if (dto.requestType === MaintenanceRequestType.GENERAL) {
      location = await this.prisma.location.findUnique({
        where: { locationId: dto.locationId! },
      });

      if (!location) {
        throw new NotFoundException('Ubicación no encontrada');
      }
    }

    // Verificar que no haya solicitud activa duplicada
    const existingRequest = await this.prisma.maintenanceRequest.findFirst({
      where: {
        ...(dto.requestType === MaintenanceRequestType.EQUIPMENT
          ? { equipmentId: dto.equipmentId }
          : { locationId: dto.locationId }),
        requestType: dto.requestType,
        status: {
          in: [
            MaintenanceStatus.PENDING,
            MaintenanceStatus.IN_REVIEW,
            MaintenanceStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        dto.requestType === MaintenanceRequestType.EQUIPMENT
          ? 'Ya existe una solicitud de mantenimiento activa para este equipo'
          : 'Ya existe un reporte activo para esta ubicación',
      );
    }

    // Buscar al encargado de soporte
    const soporte = await this.getSupportUser();

    // Obtener datos del solicitante
    solicitante = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, area: true },
    });

    if (!solicitante) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Generar el reason automático si es GENERAL y no viene
    const finalReason =
      dto.reason?.trim() ||
      (dto.requestType === MaintenanceRequestType.GENERAL
        ? 'Mantenimiento General'
        : 'Mantenimiento de equipo');

    // Crear la solicitud
    const newRequest = await this.prisma.maintenanceRequest.create({
      data: {
        requestType: dto.requestType,
        equipmentId: dto.equipmentId || null,
        locationId: dto.locationId || null,
        userId,
        reason: finalReason,
        description: dto.description,
        status: MaintenanceStatus.PENDING,
      },
      include: {
        equipment: true,
        location: true,
        user: true,
      },
    });

    // Si es EQUIPMENT, actualizar estado del equipo a MAINTENANCE
    if (dto.requestType === MaintenanceRequestType.EQUIPMENT && equipment) {
      await this.prisma.equipment.update({
        where: { equipmentId: equipment.equipmentId },
        data: { status: EquipmentStatus.MAINTENANCE },
      });
    }

    // ===== Notificaciones =====

    // Al creador (BD + WebSocket)
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title:
            dto.requestType === MaintenanceRequestType.EQUIPMENT
              ? 'Solicitud de mantenimiento creada'
              : 'Reporte general creado',
          message:
            dto.requestType === MaintenanceRequestType.EQUIPMENT
              ? `Tu solicitud para "${equipment.name}" ha sido creada exitosamente`
              : `Tu reporte para "${location.name}" ha sido creado exitosamente`,
          type: 'MAINTENANCE_REQUEST' as any,
        },
      });

      await this.gateway.notifyNewRequest(userId, {
        maintenanceRequestId: newRequest.maintenanceRequestId,
        equipmentName:
          dto.requestType === MaintenanceRequestType.EQUIPMENT
            ? equipment.name
            : location.name,
        status: newRequest.status,
      });
    } catch (error) {
      this.logger.error('Error notificando al creador:', error);
    }

    // Al encargado de soporte (BD + WebSocket)
    try {
      const tituloNotif =
        dto.requestType === MaintenanceRequestType.EQUIPMENT
          ? 'Nueva solicitud de mantenimiento'
          : 'Nuevo reporte general';

      const mensajeNotif =
        dto.requestType === MaintenanceRequestType.EQUIPMENT
          ? `${solicitante.name} solicita revisión de "${equipment.name}"`
          : `${solicitante.name} reporta un problema en "${location.name}"`;

      await this.prisma.notification.create({
        data: {
          userId: soporte.userId,
          title: tituloNotif,
          message: mensajeNotif,
          type: 'MAINTENANCE_REQUEST' as any,
        },
      });

      await this.gateway.notifySupportNewRequest(soporte.userId, {
        maintenanceRequestId: newRequest.maintenanceRequestId,
        userName: solicitante.name,
        equipmentName:
          dto.requestType === MaintenanceRequestType.EQUIPMENT
            ? equipment.name
            : location.name,
        reason: finalReason,
      });
    } catch (error) {
      this.logger.error('Error notificando al encargado de soporte:', error);
    }

    // WhatsApp al encargado de soporte
    try {
      const mensaje = this.buildWhatsAppMessage(
        { name: solicitante.name, area: solicitante.area },
        dto.requestType === MaintenanceRequestType.EQUIPMENT
          ? {
              name: equipment.name,
              serialNumber: equipment.serialNumber,
              category: equipment.category,
            }
          : {
              name: `Reporte en ${location.name}`,
              serialNumber: null,
              category: 'General',
            },
        finalReason,
        dto.description,
      );

      const numero = soporte.phone
        ? this.normalizePhone(soporte.phone)
        : this.normalizePhone(envs.EVOLUTION_NUMERO_SOPORTE);

      await this.evolutionApi.enviarMensaje(mensaje, numero);
      this.logger.log('WhatsApp enviado a soporte');
    } catch (error) {
      this.logger.error('Error enviando WhatsApp a soporte:', error);
    }

    return newRequest;
  }

  // ===== LISTAR =====
  async findMyRequests(userId: string) {
    return this.prisma.maintenanceRequest.findMany({
      where: { userId },
      include: {
        equipment: { include: { location: true } },
        location: true,
        assignedTo: {
          select: { userId: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: MaintenanceQueryDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.equipmentId) where.equipmentId = query.equipmentId;

    return this.prisma.maintenanceRequest.findMany({
      where,
      include: {
        equipment: { include: { location: true } },
        location: true,
        user: {
          select: { userId: true, name: true, email: true, area: true },
        },
        assignedTo: {
          select: { userId: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { maintenanceRequestId: id },
      include: {
        equipment: { include: { location: true } },
        location: true,
        user: {
          select: { userId: true, name: true, email: true, area: true },
        },
        assignedTo: {
          select: { userId: true, name: true, email: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud de mantenimiento no encontrada');
    }

    return request;
  }

  // ===== ACTUALIZAR ESTADO =====
async updateStatus(
  id: string,
  dto: UpdateMaintenanceStatusDto,
  userId: string,
) {
  const request = await this.findOne(id);

  // Validar transiciones
  this.validateStatusTransition(request.status, dto.status);

  // Si se rechaza, debe tener razón
  if (dto.status === MaintenanceStatus.REJECTED && !dto.rejectedReason) {
    throw new BadRequestException(
      'Debes indicar una razón para rechazar la solicitud',
    );
  }

  const updateData: any = {
    status: dto.status,
    assignedToId: userId,
  };

  if (dto.resolutionNotes) {
    updateData.resolutionNotes = dto.resolutionNotes;
  }

  if (dto.rejectedReason) {
    updateData.rejectedReason = dto.rejectedReason;
  }

  if (dto.status === MaintenanceStatus.RESOLVED) {
    updateData.resolvedAt = new Date();
  }

  const updated = await this.prisma.maintenanceRequest.update({
    where: { maintenanceRequestId: id },
    data: updateData,
    include: {
      equipment: true,
      location: true,
      user: true,
    },
  });

  // ✅ AQUÍ VA EL BLOQUE DEL ESTADO DEL EQUIPO (después del update)
  if (
    request.requestType === MaintenanceRequestType.EQUIPMENT &&
    request.equipmentId &&
    (dto.status === MaintenanceStatus.RESOLVED ||
      dto.status === MaintenanceStatus.REJECTED ||
      dto.status === MaintenanceStatus.CANCELLED)
  ) {
    // Verificar si hay un préstamo activo para este equipo
    const activeLoan = await this.prisma.equipmentLoan.findFirst({
      where: {
        equipmentId: request.equipmentId,
        status: LoanStatus.APPROVED,
      },
    });

    // Si hay préstamo activo → LOANED
    // Si no hay → AVAILABLE
    await this.prisma.equipment.update({
      where: { equipmentId: request.equipmentId },
      data: {
        status: activeLoan
          ? EquipmentStatus.LOANED
          : EquipmentStatus.AVAILABLE,
      },
    });
  }

  // Nombre a mostrar (equipo o ubicación según el tipo)
  const nombreMostrar =
    request.requestType === MaintenanceRequestType.EQUIPMENT
      ? updated.equipment?.name || 'Equipo'
      : updated.location?.name || 'Ubicación';

  // Notificación de cambio de estado al creador (BD + WebSocket)
  try {
    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        title: 'Actualizacion de mantenimiento',
        message: this.getStatusMessage(dto.status, nombreMostrar),
        type: 'MAINTENANCE_STATUS_CHANGE' as any,
      },
    });

    await this.gateway.notifyStatusChange(
      request.userId,
      updated.maintenanceRequestId,
      dto.status,
      nombreMostrar,
    );
  } catch (error) {
    this.logger.error('Error notificando cambio de estado:', error);
  }

  return updated;
}

  // ===== CANCELAR (por el creador) =====
  async cancel(id: string, userId: string) {
    const request = await this.findOne(id);

    if (request.userId !== userId) {
      throw new BadRequestException(
        'Solo puedes cancelar tus propias solicitudes',
      );
    }

    if (request.status !== MaintenanceStatus.PENDING) {
      throw new BadRequestException(
        'Solo puedes cancelar solicitudes pendientes',
      );
    }

    const cancelled = await this.prisma.maintenanceRequest.update({
      where: { maintenanceRequestId: id },
      data: { status: MaintenanceStatus.CANCELLED },
      include: { equipment: true, location: true },
    });

    // Liberar equipo solo si es EQUIPMENT
    if (
      request.requestType === MaintenanceRequestType.EQUIPMENT &&
      request.equipmentId
    ) {
      // Verificar si hay un préstamo activo para este equipo
      const activeLoan = await this.prisma.equipmentLoan.findFirst({
        where: {
          equipmentId: request.equipmentId,
          status: LoanStatus.APPROVED,
        },
      });

      // Si hay préstamo activo → LOANED
      // Si no → AVAILABLE
      await this.prisma.equipment.update({
        where: { equipmentId: request.equipmentId },
        data: {
          status: activeLoan
            ? EquipmentStatus.LOANED
            : EquipmentStatus.AVAILABLE,
        },
      });
    }

    // Notificación WS
    try {
      const nombreMostrar =
        request.requestType === MaintenanceRequestType.EQUIPMENT
          ? cancelled.equipment?.name || 'Equipo'
          : cancelled.location?.name || 'Ubicación';

      await this.gateway.notifyStatusChange(
        userId,
        cancelled.maintenanceRequestId,
        MaintenanceStatus.CANCELLED,
        nombreMostrar,
      );
    } catch (error) {
      this.logger.error('Error notificando cancelación:', error);
    }

    return cancelled;
  }

  // ===== HELPERS =====
  private getStatusMessage(
    status: MaintenanceStatus,
    equipmentName: string,
  ): string {
    const messages: Record<string, string> = {
      PENDING: `Tu solicitud de mantenimiento de "${equipmentName}" está pendiente`,
      IN_REVIEW: `Tu solicitud de mantenimiento de "${equipmentName}" está en revisión`,
      IN_PROGRESS: `Tu solicitud de mantenimiento de "${equipmentName}" está en proceso`,
      RESOLVED: `El mantenimiento de "${equipmentName}" ha sido resuelto`,
      REJECTED: `Tu solicitud de mantenimiento de "${equipmentName}" ha sido rechazada`,
      CANCELLED: `Tu solicitud de mantenimiento de "${equipmentName}" ha sido cancelada`,
    };
    return messages[status] || `Estado: ${status}`;
  }

  private validateStatusTransition(
    current: MaintenanceStatus,
    next: MaintenanceStatus,
  ) {
    const validTransitions: Record<string, MaintenanceStatus[]> = {
      PENDING: [
        MaintenanceStatus.IN_REVIEW,
        MaintenanceStatus.REJECTED,
        MaintenanceStatus.CANCELLED,
      ],
      IN_REVIEW: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.REJECTED],
      IN_PROGRESS: [MaintenanceStatus.RESOLVED],
      RESOLVED: [],
      REJECTED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `No se puede cambiar de ${current} a ${next}`,
      );
    }
  }
}