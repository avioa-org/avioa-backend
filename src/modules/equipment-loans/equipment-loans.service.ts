// backend/src/modules/equipment-loans/equipment-loans.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EquipmentDto, EquipmentStatus } from './dto/equipment.dto';
import { LoanDto, LoanStatus } from './dto/loan.dto';
import { EquipmentLoansGateway } from './equipment-loans.gateway';

@Injectable()
export class EquipmentLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EquipmentLoansGateway,
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
      throw new BadRequestException('Cannot delete equipment with active loans');
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
        actualReturnDate: status === LoanStatus.RETURNED ? new Date() : undefined,
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