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

  private async getSupportUser() {
    const soporte = await this.prisma.user.findUnique({
      where: { documentNumber: envs.SOPORTE_DOCUMENT_NUMBER },
      select: { userId: true, name: true, phone: true },
    });

    if (!soporte) {
      throw new BadRequestException(
        'No se encontró un encargado de soporte técnico configurado. Contacta al administrador.',
      );
    }

    return soporte;
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
    loan: { reason?: string | null; expectedReturnDate: Date | null },
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
      loan.expectedReturnDate
        ? `*Devolucion esperada:* ${this.formatFecha(loan.expectedReturnDate)}`
        : '',
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
    loan: { reason?: string | null; expectedReturnDate: Date | null },
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
      // ===== CASO 1: PERIFÉRICO -> SOPORTE TÉCNICO =====
      if (esPeriferico) {
        let numeroDestino = envs.EVOLUTION_NUMERO_SOPORTE;

        try {
          // Intentar obtener el usuario de soporte desde la BD
          const soporteUser = await this.getSupportUser();
          if (soporteUser && soporteUser.phone) {
            numeroDestino = soporteUser.phone;
          }
        } catch (err) {
          console.warn(
            'No se pudo obtener el teléfono de soporte de la BD, usando fallback de .env',
          );
        }

        if (!numeroDestino) {
          console.error(
            'No hay número de teléfono configurado para soporte técnico.',
          );
          return;
        }

        const phoneNormalizado = this.normalizePhone(numeroDestino);
        const ok = await this.evolutionApi.enviarMensaje(
          mensaje,
          phoneNormalizado,
        );

        if (ok) {
          console.log(
            `WhatsApp de periférico enviado a soporte (${phoneNormalizado})`,
          );
        } else {
          console.warn('Falló el envío de WhatsApp a soporte técnico');
        }
        return;
      }

      // ===== CASO 2: EQUIPO PRINCIPAL -> LÍDER DE ÁREA =====
      if (!solicitante.leaderId) {
        console.warn(
          `Solicitante ${solicitante.name} (${solicitante.userId}) no tiene leaderId asignado. Enviando al número genérico de destino.`,
        );

        const phoneNormalizadoDestino = this.normalizePhone(
          envs.EVOLUTION_NUMERO_DESTINO,
        );
        console.log(
          `[DEBUG WHATSAPP] Número final que se enviará: ${phoneNormalizadoDestino}`,
        );
        await this.evolutionApi.enviarMensaje(mensaje, phoneNormalizadoDestino);
        return;
      }

      // Buscar al líder en BD
      const lider = await this.prisma.user.findUnique({
        where: { userId: solicitante.leaderId },
        select: { userId: true, name: true, phone: true },
      });

      if (!lider) {
        console.warn(
          `Líder ${solicitante.leaderId} no encontrado en BD. Enviando al número genérico de destino.`,
        );
        await this.evolutionApi.enviarMensaje(
          mensaje,
          this.normalizePhone(envs.EVOLUTION_NUMERO_DESTINO),
        );
        return;
      }

      if (!lider.phone) {
        console.warn(
          `Líder ${lider.name} (${lider.userId}) no tiene teléfono registrado. No se envía WhatsApp.`,
        );
        return;
      }

      const phoneNormalizado = this.normalizePhone(lider.phone);
      await this.evolutionApi.enviarMensaje(mensaje, phoneNormalizado);
      console.log(
        `WhatsApp de equipo enviado al líder ${lider.name} (${phoneNormalizado})`,
      );
    } catch (error) {
      console.error('Error enviando WhatsApp de solicitud:', error);
    }
  }

  async createEquipment(data: EquipmentDto) {
    const cleanData = this.cleanObject(data);
    return this.prisma.equipment.create({
      data: cleanData as any,
      include: { location: true },
    });
  }

  async findAllEquipment(user: {
    userId: string;
    role: string;
    isLeader: boolean;
  }) {
    const isPrivileged =
      user.role === 'ADMIN' ||
      user.role === 'MANAGER' ||
      user.role === 'LEADER' ||
      user.isLeader === true;

    const include = {
      location: true,
      loans: {
        where: {
          status: { in: [LoanStatus.APPROVED, LoanStatus.PENDING] },
        },
        include: { user: true },
      },
    };

    // Líderes/managers/admins ven todos los equipos
    if (isPrivileged) {
      return this.prisma.equipment.findMany({ include });
    }

    // Empleados normales solo ven:
    // - AVAILABLE
    // - MAINTENANCE
    // - DAMAGED
    // - LOANED que ellos mismos tienen
    return this.prisma.equipment.findMany({
      where: {
        OR: [
          { status: EquipmentStatus.AVAILABLE },
          { status: EquipmentStatus.MAINTENANCE },
          { status: EquipmentStatus.DAMAGED },
          {
            AND: [
              { status: EquipmentStatus.LOANED },
              {
                loans: {
                  some: {
                    userId: user.userId,
                    status: LoanStatus.APPROVED,
                  },
                },
              },
            ],
          },
        ],
      },
      include,
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
      expectedReturnDate: data.expectedReturnDate
        ? new Date(data.expectedReturnDate)
        : undefined,
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

    // Determinar categoria del equipo
    const category = newLoan.equipment.category as EquipmentCategory;
    const esPeriferico = CATEGORIAS_SOPORTE.includes(category);

    if (esPeriferico) {
      // ===== PERIFÉRICO: solo al encargado de soporte =====
      // Si no existe el encargado, getSupportUser lanza BadRequestException
      const soporte = await this.getSupportUser();

      // Notificacion WS al encargado de soporte
      try {
        await this.gateway.notifyLeadersPendingApproval([soporte.userId], {
          equipmentLoanId: newLoan.equipmentLoanId,
          user: newLoan.user,
          equipment: newLoan.equipment,
          reason: newLoan.reason,
        });
      } catch (error) {
        console.error('Error WS notificacion soporte:', error);
      }

      // Notificacion en BD al encargado de soporte
      try {
        await this.prisma.notification.create({
          data: {
            userId: soporte.userId,
            title: 'Nueva solicitud de prestamo',
            message: `${newLoan.user?.name || 'Un usuario'} solicita "${newLoan.equipment.name}"`,
            type: 'EQUIPMENT_LOAN_REQUEST' as any,
          },
        });
      } catch (error) {
        console.error('Error guardando notificacion soporte:', error);
      }

      console.log('Notificando a soporte tecnico (periferico)');
    } else {
      // ===== EQUIPO GRANDE: notificar a LEADER + MANAGER + ADMIN =====
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
