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
import { MaintenanceStatus, EquipmentStatus } from 'generated/prisma/enums';

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
    // 1. Verificar que el equipo exista
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: dto.equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    // 2. Verificar que el equipo no esté en mantenimiento ya
    if (equipment.status === EquipmentStatus.MAINTENANCE) {
      throw new BadRequestException(
        'Este equipo ya se encuentra en mantenimiento',
      );
    }

    // 3. Verificar que el equipo no esté prestado
    if (equipment.status === EquipmentStatus.LOANED) {
      throw new BadRequestException(
        'No se puede solicitar mantenimiento de un equipo que está prestado',
      );
    }

    // 4. Buscar al encargado de soporte ANTES de crear (falla temprano si no existe)
    const soporte = await this.getSupportUser();

    // 5. Obtener datos del solicitante
    const solicitante = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, area: true },
    });

    if (!solicitante) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 6. Crear la solicitud
    const newRequest = await this.prisma.maintenanceRequest.create({
      data: {
        equipmentId: dto.equipmentId,
        userId,
        reason: dto.reason,
        description: dto.description,
        status: MaintenanceStatus.PENDING,
      },
      include: {
        equipment: true,
        user: true,
      },
    });

    // 7. Actualizar el estado del equipo a MAINTENANCE
    await this.prisma.equipment.update({
      where: { equipmentId: dto.equipmentId },
      data: { status: EquipmentStatus.MAINTENANCE },
    });

    // 8. Notificación al creador (solo BD + WebSocket, sin WhatsApp)
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Solicitud de mantenimiento creada',
          message: `Tu solicitud para "${equipment.name}" ha sido creada exitosamente`,
          type: 'MAINTENANCE_REQUEST' as any,
        },
      });

      await this.gateway.notifyNewRequest(userId, {
        maintenanceRequestId: newRequest.maintenanceRequestId,
        equipmentName: equipment.name,
        status: newRequest.status,
      });
    } catch (error) {
      this.logger.error('Error notificando al creador:', error);
    }

    // 9. Notificación al encargado de soporte (BD + WebSocket + WhatsApp)
    try {
      await this.prisma.notification.create({
        data: {
          userId: soporte.userId,
          title: 'Nueva solicitud de mantenimiento',
          message: `${solicitante.name} solicita revisión de "${equipment.name}"`,
          type: 'MAINTENANCE_REQUEST' as any,
        },
      });

      await this.gateway.notifySupportNewRequest(soporte.userId, {
        maintenanceRequestId: newRequest.maintenanceRequestId,
        userName: solicitante.name,
        equipmentName: equipment.name,
        reason: dto.reason,
      });
    } catch (error) {
      this.logger.error('Error notificando al encargado de soporte:', error);
    }

    // 10. WhatsApp al encargado de soporte
    try {
      const mensaje = this.buildWhatsAppMessage(
        { name: solicitante.name, area: solicitante.area },
        {
          name: equipment.name,
          serialNumber: equipment.serialNumber,
          category: equipment.category,
        },
        dto.reason,
        dto.description,
      );

      const numero = soporte.phone
        ? this.normalizePhone(soporte.phone)
        : this.normalizePhone(envs.EVOLUTION_NUMERO_SOPORTE);

      await this.evolutionApi.enviarMensaje(mensaje, numero);
      this.logger.log('WhatsApp de mantenimiento enviado a soporte');
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
        user: true,
      },
    });

    // Si se resuelve o rechaza, liberar el equipo
    if (
      dto.status === MaintenanceStatus.RESOLVED ||
      dto.status === MaintenanceStatus.REJECTED ||
      dto.status === MaintenanceStatus.CANCELLED
    ) {
      await this.prisma.equipment.update({
        where: { equipmentId: request.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });
    }

    // Notificación de cambio de estado al creador (BD + WebSocket)
    try {
      await this.prisma.notification.create({
        data: {
          userId: request.userId,
          title: 'Actualizacion de mantenimiento',
          message: this.getStatusMessage(
            dto.status,
            updated.equipment.name,
          ),
          type: 'MAINTENANCE_STATUS_CHANGE' as any,
        },
      });

      await this.gateway.notifyStatusChange(
        request.userId,
        updated.maintenanceRequestId,
        dto.status,
        updated.equipment.name,
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
      include: { equipment: true },
    });

    // Liberar equipo
    await this.prisma.equipment.update({
      where: { equipmentId: request.equipmentId },
      data: { status: EquipmentStatus.AVAILABLE },
    });

    // Notificación WS
    try {
      await this.gateway.notifyStatusChange(
        userId,
        cancelled.maintenanceRequestId,
        MaintenanceStatus.CANCELLED,
        cancelled.equipment.name,
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
      IN_REVIEW: [
        MaintenanceStatus.IN_PROGRESS,
        MaintenanceStatus.REJECTED,
      ],
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