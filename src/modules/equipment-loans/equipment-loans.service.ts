import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
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
import { CreateLocationDto } from './dto/location.dto';

// Categorías que se notifican al líder de tecnología
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
  private readonly logger = new Logger(EquipmentLoansService.name);

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

  // ===== BUSCAR USUARIOS POR DOCUMENTO =====
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

  private async getTechLeaderUser() {
    const lider = await this.prisma.user.findUnique({
      where: { documentNumber: envs.LIDER_TECNOLOGIA_DOCUMENT_NUMBER },
      select: { userId: true, name: true, phone: true },
    });

    if (!lider) {
      this.logger.error(
        `Líder de tecnología no encontrado (documentNumber: ${envs.LIDER_TECNOLOGIA_DOCUMENT_NUMBER})`,
      );
      throw new BadRequestException(
        'No se encontró un líder de tecnología configurado. Contacta al administrador.',
      );
    }

    return lider;
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
        const soporteUser = await this.getSupportUser();

        if (!soporteUser.phone) {
          this.logger.warn(
            `Encargado de soporte ${soporteUser.name} no tiene teléfono registrado. No se envía WhatsApp.`,
          );
          return;
        }

        const phoneNormalizado = this.normalizePhone(soporteUser.phone);
        const ok = await this.evolutionApi.enviarMensaje(
          mensaje,
          phoneNormalizado,
        );

        if (ok) {
          this.logger.log(
            `WhatsApp de periférico enviado a soporte (${phoneNormalizado})`,
          );
        } else {
          this.logger.warn('Falló el envío de WhatsApp a soporte técnico');
        }
        return;
      }

      // ===== CASO 2: EQUIPO IMPORTANTE -> LÍDER DE TECNOLOGÍA =====
      const liderTecnologia = await this.getTechLeaderUser();

      if (!liderTecnologia.phone) {
        this.logger.warn(
          `Líder de tecnología ${liderTecnologia.name} no tiene teléfono registrado. No se envía WhatsApp.`,
        );
        return;
      }

      const phoneNormalizado = this.normalizePhone(liderTecnologia.phone);
      await this.evolutionApi.enviarMensaje(mensaje, phoneNormalizado);
      this.logger.log(
        `WhatsApp de solicitud enviado al líder de tecnología ${liderTecnologia.name}`,
      );
    } catch (error) {
      this.logger.error('Error enviando WhatsApp de solicitud:', error);
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
    isSupport: boolean;
  }) {
    const isAdmin = user.role === 'ADMIN';
    const isTech = user.isSupport === true;
    const isLeader = user.role === 'LEADER' || user.isLeader === true;

    // Include para traer el loan activo: solo cuando el equipo está físicamente
    // en poder de alguien (LOANED), no cuando está APPROVED ni PENDING.
    const include = {
      location: true,
      loans: {
        where: {
          status: LoanStatus.LOANED,
        },
        include: { user: true },
      },
    };

    // Admin y tecnología ven todos los equipos sin restricción
    if (isAdmin || isTech) {
      return this.prisma.equipment.findMany({ include });
    }

    // Líder: ve disponibles/mantenimiento/dañados, y los LOANED que estén
    // prestados a sus subordinados directos o a él mismo.
    if (isLeader) {
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
                      status: LoanStatus.LOANED,
                      user: {
                        OR: [
                          { userId: user.userId },
                          { leaderId: user.userId },
                        ],
                      },
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

    // Empleado normal: ve disponibles/mantenimiento/dañados, y los LOANED
    // que estén prestados a él mismo.
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
                    status: LoanStatus.LOANED,
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
      

    //Se valida antes de crear un nuevo loan para evitar duplicados en las requests, tal...
    const existingLoan = await this.prisma.equipmentLoan.findFirst({
      where: {
        equipmentId: data.equipmentId,
        status: {
          in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.LOANED],
        },
      },
      select: {
        equipmentLoanId: true,
        status: true,
        userId: true,
      },
    });

    if (existingLoan) {
      throw new BadRequestException({
        message: 'Este equipo ya tiene una solicitud de préstamo en curso',
        error: 'EQUIPMENT_ALREADY_REQUESTED',
      });
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
        user: {
          select: {
            userId: true,
            name: true,
            area: true,
            phone: true,
            leaderId: true,
          },
        },
      },
    });

    // Notificación WS al creador
    try {
      await this.gateway.notifyNewLoan(userId, {
        equipmentLoanId: newLoan.equipmentLoanId,
        equipment: newLoan.equipment,
        status: newLoan.status,
      });
    } catch (error) {
      this.logger.error('Error WS notificación creador:', error);
    }

    // Notificación en BD al creador
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Solicitud de préstamo creada',
          message: `Tu solicitud para "${newLoan.equipment.name}" ha sido creada exitosamente`,
          type: 'EQUIPMENT_LOAN_REQUEST' as any,
        },
      });
    } catch (error) {
      this.logger.error('Error guardando notificación creador:', error);
    }

    // ===== NOTIFICAR AL LÍDER DEL EMPLEADO =====
    // Si el empleado tiene líder, se le notifica a él.
    // Si no tiene líder, se notifica a todo el equipo de tecnología (isSupport = true).

    const empleadoTieneLider = newLoan.user.leaderId != null;

    if (empleadoTieneLider) {
      // ===== CASO 1: notificar al líder del empleado =====
      const lider = await this.prisma.user.findUnique({
        where: { userId: newLoan.user.leaderId as string },
        select: { userId: true, name: true, phone: true },
      });

      if (lider) {
        // WS al líder
        try {
          await this.gateway.notifyLeadersPendingApproval([lider.userId], {
            equipmentLoanId: newLoan.equipmentLoanId,
            user: newLoan.user,
            equipment: newLoan.equipment,
            reason: newLoan.reason,
          });
        } catch (error) {
          this.logger.error('Error WS notificación líder:', error);
        }

        // Notificación BD al líder
        try {
          await this.prisma.notification.create({
            data: {
              userId: lider.userId,
              title: 'Nueva solicitud de préstamo',
              message: `${newLoan.user?.name || 'Un colaborador'} solicita "${newLoan.equipment.name}"`,
              type: 'EQUIPMENT_LOAN_REQUEST' as any,
            },
          });
        } catch (error) {
          this.logger.error('Error guardando notificación líder:', error);
        }

        // WhatsApp al líder
        try {
          if (!lider.phone) {
            this.logger.warn(
              `Líder ${lider.name} no tiene teléfono registrado. No se envía WhatsApp.`,
            );
          } else {
            const mensaje = this.buildMensajeSolicitud(
              { name: newLoan.user.name, area: newLoan.user.area },
              {
                name: newLoan.equipment.name,
                category: newLoan.equipment.category as EquipmentCategory,
                serialNumber: newLoan.equipment.serialNumber,
              },
              {
                reason: newLoan.reason,
                expectedReturnDate: newLoan.expectedReturnDate,
              },
              true,
            );

            const phoneNormalizado = this.normalizePhone(lider.phone);
            await this.evolutionApi.enviarMensaje(mensaje, phoneNormalizado);
            this.logger.log(
              `WhatsApp de solicitud enviado al líder ${lider.name}`,
            );
          }
        } catch (error) {
          this.logger.error('Error enviando WhatsApp al líder:', error);
        }
      } else {
        this.logger.warn(
          `Líder con userId ${newLoan.user.leaderId} no encontrado`,
        );
      }
    } else {
      // ===== CASO 2: empleado sin líder → notificar a todo el equipo de tecnología =====
      const equipoTech = await this.prisma.user.findMany({
        where: {
          isSupport: true,
          status: 'ACTIVE',
          NOT: { userId },
        },
        select: { userId: true },
      });

      this.logger.log(
        `Empleado sin líder. Notificando a ${equipoTech.length} usuarios de tecnología.`,
      );

      if (equipoTech.length > 0) {
        const techIds = equipoTech.map((u) => u.userId);

        try {
          await this.gateway.notifyLeadersPendingApproval(techIds, {
            equipmentLoanId: newLoan.equipmentLoanId,
            user: newLoan.user,
            equipment: newLoan.equipment,
            reason: newLoan.reason,
          });
        } catch (error) {
          this.logger.error('Error WS notificación equipo tech:', error);
        }

        try {
          await Promise.all(
            techIds.map((techId) =>
              this.prisma.notification.create({
                data: {
                  userId: techId,
                  title: 'Nueva solicitud de préstamo',
                  message: `${newLoan.user?.name || 'Un usuario'} solicita "${newLoan.equipment.name}"`,
                  type: 'EQUIPMENT_LOAN_REQUEST' as any,
                },
              }),
            ),
          );
        } catch (error) {
          this.logger.error(
            'Error guardando notificaciones equipo tech:',
            error,
          );
        }
      }

      // TODO: WhatsApp a equipo tech cuando no hay líder (definir en Bloque 3)
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

  async findMyLoanedEquipment(userId: string) {
    return this.prisma.equipment.findMany({
      where: {
        status: {
          in: [EquipmentStatus.LOANED, EquipmentStatus.MAINTENANCE],
        },
        loans: {
          some: {
            userId,
            status: LoanStatus.APPROVED,
          },
        },
      },
      include: {
        location: true,
        loans: {
          where: {
            userId,
            status: LoanStatus.APPROVED,
          },
          include: {
            user: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAllLoans(
    user: {
      userId: string;
      role: string;
      isLeader: boolean;
      isSupport: boolean;
    },
    filters?: {
      status?: LoanStatus;
      userId?: string;
      equipmentId?: string;
    },
  ) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;

    const isAdmin = user.role === 'ADMIN';
    const isTech = user.isSupport === true;
    const isLeader = user.role === 'LEADER' || user.isLeader === true;

    if (isAdmin) {
      // Admin ve todo, sin restricción
      if (filters?.userId) where.userId = filters.userId;
    } else if (isTech) {
      // Tecnología ve:
      //   - Todas las solicitudes que ya pasaron por el líder (no están en PENDING)
      //   - Las solicitudes en PENDING de empleados sin líder (van directo a tech)
      // NO ve las solicitudes en PENDING de empleados que tienen líder asignado.
      where.NOT = {
        AND: [
          { status: LoanStatus.PENDING },
          { user: { leaderId: { not: null } } },
        ],
      };
      if (filters?.userId) where.userId = filters.userId;
    } else if (isLeader) {
      // Líder ve las suyas y las de sus subordinados directos
      where.OR = [{ userId: user.userId }, { user: { leaderId: user.userId } }];
    } else {
      // Empleado normal solo ve las suyas
      where.userId = user.userId;
    }
    return this.prisma.equipmentLoan.findMany({
      where,
      include: {
        equipment: { include: { location: true } },
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            leaderId: true,
          },
        },
        approvedBy: {
          select: { userId: true, name: true, email: true },
        },
        returnedBy: {
          select: { userId: true, name: true, email: true },
        },
        leaderApprovedBy: {
          select: { userId: true, name: true, email: true },
        },
        deliveredBy: {
          select: { userId: true, name: true, email: true },
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

  async updateLoanStatus(
    id: string,
    status: LoanStatus,
    user: {
      userId: string;
      role: string;
      isLeader: boolean;
      isSupport: boolean;
    },
  ) {
    const loan = await this.findOneLoan(id);

    const isAdmin = user.role === 'ADMIN';
    const isTech = user.isSupport === true;
    const isLeader = user.role === 'LEADER' || user.isLeader === true;

    this.validateLoanStatusTransition(loan.status, status);

    const empleadoTieneLider = loan.user.leaderId != null;

    // ===== VALIDACIONES POR ROL Y ESTADO =====

    if (loan.status === LoanStatus.PENDING && status === LoanStatus.APPROVED) {
      const canApprove =
        isAdmin ||
        (isTech && !empleadoTieneLider) ||
        (isLeader && loan.user.leaderId === user.userId);
      if (!canApprove) {
        throw new ForbiddenException(
          'No tienes permisos para aprobar esta solicitud',
        );
      }
    }

    if (loan.status === LoanStatus.PENDING && status === LoanStatus.REJECTED) {
      const canReject =
        isAdmin ||
        (isTech && !empleadoTieneLider) ||
        (isLeader && loan.user.leaderId === user.userId);
      if (!canReject) {
        throw new ForbiddenException(
          'No tienes permisos para rechazar esta solicitud',
        );
      }
    }

    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.LOANED) {
      if (!isAdmin && !isTech) {
        throw new ForbiddenException(
          'Solo el equipo de tecnología puede entregar el equipo',
        );
      }
    }

    if (loan.status === LoanStatus.LOANED && status === LoanStatus.RETURNED) {
      if (!isAdmin && !isTech) {
        throw new ForbiddenException(
          'Solo el equipo de tecnología puede registrar la devolución',
        );
      }
    }

    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.REJECTED) {
      if (!isAdmin && !isTech) {
        throw new ForbiddenException(
          'Solo el equipo de tecnología puede rechazar una solicitud aprobada',
        );
      }
    }

    // ===== CONSTRUIR EL UPDATE =====

    const updateData: any = { status };

    // PENDING -> APPROVED (aprobación del líder, o tecnología si no hay líder)
    if (loan.status === LoanStatus.PENDING && status === LoanStatus.APPROVED) {
      updateData.leaderApprovedById = user.userId;
      updateData.leaderApprovedAt = new Date();
    }

    // PENDING -> REJECTED (rechazo del líder, o tecnología si no hay líder)
    if (loan.status === LoanStatus.PENDING && status === LoanStatus.REJECTED) {
      updateData.leaderApprovedById = user.userId;
      updateData.leaderApprovedAt = new Date();
    }

    // APPROVED -> LOANED (entrega por tecnología)
    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.LOANED) {
      updateData.deliveredById = user.userId;
      updateData.deliveredAt = new Date();
      updateData.approvedById = user.userId;

      await this.prisma.equipment.update({
        where: { equipmentId: loan.equipmentId },
        data: { status: EquipmentStatus.LOANED },
      });
    }

    // LOANED -> RETURNED (devolución por tecnología)
    if (loan.status === LoanStatus.LOANED && status === LoanStatus.RETURNED) {
      updateData.returnedById = user.userId;
      updateData.actualReturnDate = new Date();

      await this.prisma.equipment.update({
        where: { equipmentId: loan.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });
    }

    // APPROVED -> REJECTED (tecnología rechaza después de aprobación del líder)
    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.REJECTED) {
      updateData.approvedById = user.userId;
    }

    const updatedLoan = await this.prisma.equipmentLoan.update({
      where: { equipmentLoanId: id },
      data: updateData,
      include: {
        equipment: { include: { location: true } },
        user: true,
        approvedBy: true,
        returnedBy: true,
        leaderApprovedBy: true,
        deliveredBy: true,
      },
    });

    // ===== NOTIFICACIONES =====

    // WS al empleado creador
    try {
      await this.gateway.notifyStatusChange(
        loan.userId,
        updatedLoan.equipmentLoanId,
        status,
        updatedLoan.equipment.name,
      );
    } catch (error) {
      this.logger.error('Error WS cambio de estado:', error);
    }

    // Notificación BD al empleado creador
    try {
      await this.prisma.notification.create({
        data: {
          userId: loan.userId,
          title: 'Actualización de préstamo',
          message: this.getStatusMessage(status, updatedLoan.equipment.name),
          type: this.getNotificationType(status) as any,
        },
      });
    } catch (error) {
      this.logger.error(
        'Error guardando notificación cambio de estado:',
        error,
      );
    }

    // ===== NOTIFICACIONES ADICIONALES SEGÚN TRANSICIÓN =====

    // PENDING -> APPROVED: notificar a todo el equipo de tecnología
    if (loan.status === LoanStatus.PENDING && status === LoanStatus.APPROVED) {
      await this.notificarEquipoTecnologia(
        updatedLoan.equipmentLoanId,
        updatedLoan.user?.name ?? 'Un colaborador',
        updatedLoan.equipment.name,
      );
    }

    // APPROVED -> LOANED: notificar al líder del empleado
    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.LOANED) {
      await this.notificarLider(
        loan.user.leaderId,
        'Equipo entregado',
        `Se entregó "${updatedLoan.equipment.name}" a ${updatedLoan.user?.name ?? 'un colaborador'}`,
      );
    }

    // LOANED -> RETURNED: notificar al líder del empleado
    if (loan.status === LoanStatus.LOANED && status === LoanStatus.RETURNED) {
      await this.notificarLider(
        loan.user.leaderId,
        'Equipo devuelto',
        `${updatedLoan.user?.name ?? 'Un colaborador'} devolvió "${updatedLoan.equipment.name}"`,
      );
    }

    // APPROVED -> REJECTED: notificar al líder del empleado
    if (loan.status === LoanStatus.APPROVED && status === LoanStatus.REJECTED) {
      await this.notificarLider(
        loan.user.leaderId,
        'Solicitud rechazada',
        `Tecnología rechazó la solicitud de "${updatedLoan.equipment.name}" de ${updatedLoan.user?.name ?? 'un colaborador'}`,
      );
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

    try {
      await this.gateway.notifyStatusChange(
        userId,
        cancelledLoan.equipmentLoanId,
        LoanStatus.CANCELLED,
        loan.equipment?.name || 'Equipo',
      );
    } catch (error) {
      this.logger.error('Error WS cancelacion:', error);
    }

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
      this.logger.error('Error guardando notificacion cancelacion:', error);
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

  async createLocation(dto: CreateLocationDto[]) {
    return this.prisma.location.createMany({ data: dto });
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
        LoanStatus.REJECTED,
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

  private async notificarEquipoTecnologia(
    equipmentLoanId: string,
    nombreSolicitante: string,
    nombreEquipo: string,
  ) {
    try {
      const equipoTech = await this.prisma.user.findMany({
        where: {
          isSupport: true,
          status: 'ACTIVE',
        },
        select: { userId: true },
      });

      if (equipoTech.length === 0) return;

      const techIds = equipoTech.map((u) => u.userId);

      // WS
      try {
        await this.gateway.notifyLeadersPendingApproval(techIds, {
          equipmentLoanId,
          user: { name: nombreSolicitante } as any,
          equipment: { name: nombreEquipo } as any,
        });
      } catch (error) {
        this.logger.error('Error WS notificación a equipo tech:', error);
      }

      // Notificación BD individual
      try {
        await Promise.all(
          techIds.map((techId) =>
            this.prisma.notification.create({
              data: {
                userId: techId,
                title: 'Solicitud aprobada por líder',
                message: `${nombreSolicitante} tiene un préstamo aprobado de "${nombreEquipo}" pendiente por entregar`,
                type: 'EQUIPMENT_LOAN_APPROVED' as any,
              },
            }),
          ),
        );
      } catch (error) {
        this.logger.error(
          'Error guardando notificaciones a equipo tech:',
          error,
        );
      }
    } catch (error) {
      this.logger.error('Error notificando a equipo tech:', error);
    }
  }

  private async notificarLider(
    leaderId: string | null,
    title: string,
    message: string,
  ) {
    if (!leaderId) return;

    try {
      await this.prisma.notification.create({
        data: {
          userId: leaderId,
          title,
          message,
          type: 'EQUIPMENT_LOAN_REQUEST' as any,
        },
      });
    } catch (error) {
      this.logger.error('Error notificando al líder:', error);
    }
  }
}
