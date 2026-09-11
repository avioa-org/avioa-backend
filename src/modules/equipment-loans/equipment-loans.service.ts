// backend/src/modules/equipment-loans/equipment-loans.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  EquipmentDto,
  EquipmentStatus,
  EquipmentCategory,
} from './dto/equipment.dto';
import { LoanDto, LoanStatus } from './dto/loan.dto';
import { EquipmentLoansGateway } from './equipment-loans.gateway';
import { EvolutionApiService } from '../../infrastructure/evolution-api/evolution-api.service';
import { envs } from '../../config/env.config';

// Categorías que se notifican al líder del área
const CATEGORIAS_LIDER: EquipmentCategory[] = [
  EquipmentCategory.LAPTOP,
  EquipmentCategory.CELLPHONE,
  EquipmentCategory.MONITOR,
  EquipmentCategory.PRINTER,
  EquipmentCategory.PROJECTOR,
];

// Categorías que se notifican a soporte técnico
const CATEGORIAS_SOPORTE: EquipmentCategory[] = [
  EquipmentCategory.KEYBOARD,
  EquipmentCategory.MOUSE,
  EquipmentCategory.HEADPHONES,
];

@Injectable()
export class EquipmentLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EquipmentLoansGateway,
    private readonly evolutionApi: EvolutionApiService,
  ) {}

  // Helper para limpiar objetos undefined
  private cleanObject<T>(obj: T): Partial<T> {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
  }

  // ===== HELPERS WHATSAPP =====
  private formatCategoria(cat: EquipmentCategory): string {
    const labels: Record<string, string> = {
      LAPTOP: 'Laptop',
      CELLPHONE: 'Telefono',
      KEYBOARD: 'Teclado',
      MOUSE: 'Mouse',
      HEADPHONES: 'Audifonos',
      MONITOR: 'Monitor',
      PRINTER: 'Impresora',
      PROJECTOR: 'Proyector',
      OTHER: 'Otro',
    };
    return labels[cat] || cat;
  }

  private formatFecha(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (!cleaned.startsWith('57')) {
      cleaned = `57${cleaned}`;
    }

    return cleaned;
  }

  private buildMensajeSolicitud(
    solicitante: { name: string; area?: string | null },
    equipment: {
      name: string;
      category: EquipmentCategory;
      serialNumber?: string | null;
    },
    loan: { reason?: string | null; expectedReturnDate: Date },
    esPeriferico: boolean,
  ): string {
    const titulo = esPeriferico
      ? '*NUEVA SOLICITUD DE PERIFERICO*'
      : '*NUEVA SOLICITUD DE PRESTAMO*';

    const lineas = [
      titulo,
      '',
      `*Solicitante:* ${solicitante.name}`,
      solicitante.area ? `*Area:* ${solicitante.area}` : '',
      `*Equipo:* ${equipment.name}`,
      `*Categoria:* ${this.formatCategoria(equipment.category)}`,
      equipment.serialNumber ? `*Serial:* ${equipment.serialNumber}` : '',
      loan.reason ? `*Motivo:* ${loan.reason}` : '',
      `*Devolucion esperada:* ${this.formatFecha(loan.expectedReturnDate)}`,
      '',
      'Revisa el portal para aprobar o rechazar.',
    ];

    return lineas.filter(Boolean).join('\n');
  }

  private async enviarWhatsAppSolicitud(
    equipmentCategory: EquipmentCategory,
    solicitante: {
      userId: string;
      name: string;
      area?: string | null;
      leaderId?: string | null;
    },
    equipment: {
      name: string;
      category: EquipmentCategory;
      serialNumber?: string | null;
    },
    loan: { reason?: string | null; expectedReturnDate: Date },
  ): Promise<void> {
    // Ignorar OTHER
    if (equipmentCategory === EquipmentCategory.OTHER) {
      return;
    }

    const esPeriferico = CATEGORIAS_SOPORTE.includes(equipmentCategory);
    const esLider = CATEGORIAS_LIDER.includes(equipmentCategory);

    if (!esPeriferico && !esLider) {
      return;
    }

    const mensaje = this.buildMensajeSolicitud(
      solicitante,
      equipment,
      loan,
      esPeriferico,
    );

    try {
      // Caso 1: Periférico -> soporte técnico (número de env)
      if (esPeriferico) {
        const ok = await this.evolutionApi.enviarMensaje(
          mensaje,
          envs.EVOLUTION_NUMERO_SOPORTE,
        );
        if (ok) {
          console.log('WhatsApp de solicitud enviado a soporte tecnico');
        } else {
          console.warn('Fallo el envio de WhatsApp a soporte tecnico');
        }
        return;
      }

      // Caso 2: Categoría de líder
      // 2a. Sin leaderId -> warning + enviar al genérico
      if (!solicitante.leaderId) {
        console.warn(
          `Solicitante ${solicitante.name} (${solicitante.userId}) no tiene leaderId asignado. Enviando al numero generico.`,
        );
        await this.evolutionApi.enviarMensaje(mensaje);
        return;
      }

      // 2b. Buscar al líder
      const lider = await this.prisma.user.findUnique({
        where: { userId: solicitante.leaderId },
        select: { userId: true, name: true, phone: true },
      });

      if (!lider) {
        console.warn(
          `Lider ${solicitante.leaderId} no encontrado. Enviando al numero generico.`,
        );
        await this.evolutionApi.enviarMensaje(mensaje);
        return;
      }

      // 2c. Líder sin telefono -> warning, NO enviar nada
      if (!lider.phone) {
        console.warn(
          `Lider ${lider.name} (${lider.userId}) no tiene telefono registrado. No se envia WhatsApp.`,
        );
        return;
      }

      // 2d. Enviar al líder
      const phoneNormalizado = this.normalizePhone(lider.phone);
      await this.evolutionApi.enviarMensaje(mensaje, phoneNormalizado);
      console.log(`WhatsApp de solicitud enviado al lider ${lider.name}`);
    } catch (error) {
      console.error('Error enviando WhatsApp de solicitud:', error);
    }
  }

  // ===== EQUIPOS =====
  async createEquipment(data: EquipmentDto) {
    const cleanData = this.cleanObject(data);
    return this.prisma.equipment.create({
      data: cleanData as any,
      include: { location: true },
    });
  }

  async findAllEquipment() {
    return this.prisma.equipment.findMany({
      include: {
        location: true,
        loans: {
          where: { status: { in: [LoanStatus.LOANED, LoanStatus.PENDING] } },
          include: { user: true },
        },
      },
    });
  }

  async findOneEquipment(id: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: id },
      include: { location: true, loans: true },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    return equipment;
  }

  async updateEquipment(id: string, data: EquipmentDto) {
    await this.findOneEquipment(id);
    const cleanData = this.cleanObject(data);
    return this.prisma.equipment.update({
      where: { equipmentId: id },
      data: cleanData as any,
      include: { location: true },
    });
  }

  async deleteEquipment(id: string) {
    const equipment = await this.findOneEquipment(id);
    const activeLoans = equipment.loans.filter(
      (l) => l.status === LoanStatus.LOANED || l.status === LoanStatus.PENDING,
    );
    if (activeLoans.length > 0) {
      throw new BadRequestException(
        'Cannot delete equipment with active loans',
      );
    }
    return this.prisma.equipment.delete({
      where: { equipmentId: id },
    });
  }

  // ===== PRÉSTAMOS =====
  async createLoan(userId: string, data: LoanDto) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { equipmentId: data.equipmentId },
      include: { location: true },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new BadRequestException('Equipment is not available');
    }

    const loanData = {
      equipmentId: data.equipmentId,
      userId,
      reason: data.reason,
      observation: data.observation,
      expectedReturnDate: new Date(data.expectedReturnDate),
      status: LoanStatus.PENDING,
    };

    const newLoan = await this.prisma.equipmentLoan.create({
      data: loanData,
      include: {
        equipment: { include: { location: true } },
        user: true,
      },
    });

    // Notificacion WS al creador
    try {
      await this.gateway.notifyNewLoan(userId, {
        equipmentLoanId: newLoan.equipmentLoanId,
        equipment: newLoan.equipment,
        status: newLoan.status,
      });
    } catch (error) {
      console.error('Error WS notificacion creador:', error);
    }

    // Notificacion en BD al creador
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Solicitud de prestamo creada',
          message: `Tu solicitud para "${newLoan.equipment.name}" ha sido creada exitosamente`,
          type: 'EQUIPMENT_LOAN_REQUEST' as any,
        },
      });
    } catch (error) {
      console.error('Error guardando notificacion creador:', error);
    }

    // Buscar aprobadores (LEADER + MANAGER + ADMIN)
    const approvers = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: 'LEADER', isLeader: true },
          { role: 'MANAGER' },
          { role: 'ADMIN' },
        ],
        AND: {
          userId: { not: userId },
        },
      },
      select: { userId: true },
    });

    console.log(`Notificando a ${approvers.length} aprobadores`);

    if (approvers.length > 0) {
      const approverIds = approvers.map((u) => u.userId);

      // Notificacion WS a aprobadores
      try {
        await this.gateway.notifyLeadersPendingApproval(approverIds, {
          equipmentLoanId: newLoan.equipmentLoanId,
          user: newLoan.user,
          equipment: newLoan.equipment,
          reason: newLoan.reason,
        });
      } catch (error) {
        console.error('Error WS notificacion lideres:', error);
      }

      // Notificacion en BD a cada aprobador
      try {
        await Promise.all(
          approverIds.map((approverId) =>
            this.prisma.notification.create({
              data: {
                userId: approverId,
                title: 'Nueva solicitud de prestamo',
                message: `${newLoan.user?.name || 'Un usuario'} solicita "${newLoan.equipment.name}"`,
                type: 'EQUIPMENT_LOAN_REQUEST' as any,
              },
            }),
          ),
        );
      } catch (error) {
        console.error('Error guardando notificaciones lideres:', error);
      }
    }

    // WhatsApp: notificar al lider de area o a soporte tecnico segun categoria
    try {
      await this.enviarWhatsAppSolicitud(
        newLoan.equipment.category as EquipmentCategory,
        {
          userId: newLoan.user.userId,
          name: newLoan.user.name,
          area: newLoan.user.area,
          leaderId: newLoan.user.leaderId,
        },
        {
          name: newLoan.equipment.name,
          category: newLoan.equipment.category as EquipmentCategory,
          serialNumber: newLoan.equipment.serialNumber,
        },
        {
          reason: newLoan.reason,
          expectedReturnDate: newLoan.expectedReturnDate,
        },
      );
    } catch (error) {
      console.error('Error enviando WhatsApp de solicitud:', error);
    }

    return newLoan;
  }

  async findMyLoans(userId: string) {
    return this.prisma.equipmentLoan.findMany({
      where: { userId },
      include: { equipment: { include: { location: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllLoans(filters?: {
    status?: LoanStatus;
    userId?: string;
    equipmentId?: string;
  }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;

    return this.prisma.equipmentLoan.findMany({
      where,
      include: {
        equipment: { include: { location: true } },
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
        returnedBy: {
          select: {
            userId: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneLoan(id: string) {
    const loan = await this.prisma.equipmentLoan.findUnique({
      where: { equipmentLoanId: id },
      include: {
        equipment: { include: { location: true } },
        user: true,
        approvedBy: true,
        returnedBy: true,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async updateLoanStatus(id: string, status: LoanStatus, userId?: string) {
    const loan = await this.findOneLoan(id);

    // Validar transiciones
    this.validateLoanStatusTransition(loan.status, status);

    // Si se aprueba, cambiar estado del equipo
    if (status === LoanStatus.APPROVED) {
      await this.prisma.equipment.update({
        where: { equipmentId: loan.equipmentId },
        data: { status: EquipmentStatus.LOANED },
      });
    }

    // Si se devuelve, cambiar estado del equipo
    if (status === LoanStatus.RETURNED) {
      await this.prisma.equipment.update({
        where: { equipmentId: loan.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });
    }

    const updatedLoan = await this.prisma.equipmentLoan.update({
      where: { equipmentLoanId: id },
      data: {
        status,
        approvedById:
          status === LoanStatus.APPROVED || status === LoanStatus.REJECTED
            ? userId
            : undefined,
        returnedById: status === LoanStatus.RETURNED ? userId : undefined,
        actualReturnDate:
          status === LoanStatus.RETURNED ? new Date() : undefined,
      },
      include: {
        equipment: { include: { location: true } },
        user: true,
        approvedBy: true,
        returnedBy: true,
      },
    });

    // Notificacion WS de cambio de estado
    try {
      await this.gateway.notifyStatusChange(
        loan.userId,
        updatedLoan.equipmentLoanId,
        status,
        updatedLoan.equipment.name,
      );
    } catch (error) {
      console.error('Error WS cambio de estado:', error);
    }

    // Notificacion en BD al usuario
    try {
      await this.prisma.notification.create({
        data: {
          userId: loan.userId,
          title: 'Actualizacion de prestamo',
          message: this.getStatusMessage(status, updatedLoan.equipment.name),
          type: this.getNotificationType(status) as any,
        },
      });
    } catch (error) {
      console.error('Error guardando notificacion cambio de estado:', error);
    }

    return updatedLoan;
  }

  async cancelLoan(id: string, userId: string) {
    const loan = await this.findOneLoan(id);
    if (loan.userId !== userId) {
      throw new BadRequestException('You can only cancel your own loans');
    }
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only pending loans can be cancelled');
    }

    const cancelledLoan = await this.prisma.equipmentLoan.update({
      where: { equipmentLoanId: id },
      data: { status: LoanStatus.CANCELLED },
    });

    // Notificacion WS de cancelacion
    try {
      await this.gateway.notifyStatusChange(
        userId,
        cancelledLoan.equipmentLoanId,
        LoanStatus.CANCELLED,
        loan.equipment?.name || 'Equipo',
      );
    } catch (error) {
      console.error('Error WS cancelacion:', error);
    }

    // Notificacion en BD de cancelacion
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Solicitud cancelada',
          message: `Tu solicitud de prestamo de "${loan.equipment?.name || 'Equipo'}" ha sido cancelada`,
          type: 'EQUIPMENT_LOAN_REQUEST' as any,
        },
      });
    } catch (error) {
      console.error('Error guardando notificacion cancelacion:', error);
    }

    return cancelledLoan;
  }

  // ===== UBICACIONES =====
  async findAllLocations() {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ===== HELPERS =====
  private getStatusMessage(status: LoanStatus, equipmentName: string): string {
    const messages: Record<string, string> = {
      [LoanStatus.APPROVED]: `Tu solicitud de prestamo de "${equipmentName}" ha sido aprobada`,
      [LoanStatus.REJECTED]: `Tu solicitud de prestamo de "${equipmentName}" ha sido rechazada`,
      [LoanStatus.LOANED]: `El equipo "${equipmentName}" te ha sido entregado`,
      [LoanStatus.RETURNED]: `El equipo "${equipmentName}" ha sido devuelto exitosamente`,
      [LoanStatus.CANCELLED]: `Tu solicitud de prestamo de "${equipmentName}" ha sido cancelada`,
    };
    return messages[status] || `Estado del prestamo: ${status}`;
  }

  private getNotificationType(status: LoanStatus): string {
    switch (status) {
      case LoanStatus.APPROVED:
        return 'EQUIPMENT_LOAN_APPROVED';
      case LoanStatus.REJECTED:
        return 'EQUIPMENT_LOAN_REJECTED';
      case LoanStatus.RETURNED:
        return 'EQUIPMENT_LOAN_RETURNED';
      default:
        return 'EQUIPMENT_LOAN_REQUEST';
    }
  }

  // ===== VALIDACIONES =====
  private validateLoanStatusTransition(
    currentStatus: string,
    newStatus: LoanStatus,
  ) {
    const validTransitions: Record<string, LoanStatus[]> = {
      [LoanStatus.PENDING]: [
        LoanStatus.APPROVED,
        LoanStatus.REJECTED,
        LoanStatus.CANCELLED,
      ],
      [LoanStatus.APPROVED]: [
        LoanStatus.LOANED,
        LoanStatus.CANCELLED,
        LoanStatus.RETURNED,
      ],
      [LoanStatus.LOANED]: [LoanStatus.RETURNED, 'OVERDUE' as LoanStatus],
      [LoanStatus.RETURNED]: [],
      ['OVERDUE' as LoanStatus]: [LoanStatus.RETURNED],
      [LoanStatus.REJECTED]: [],
      [LoanStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
