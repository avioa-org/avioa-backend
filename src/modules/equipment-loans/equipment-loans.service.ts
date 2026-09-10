import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    // 🔔 NOTIFICACIÓN: Nueva solicitud de préstamo
    this.gateway.notifyNewLoan(userId, {
      equipmentLoanId: newLoan.equipmentLoanId,
      equipment: newLoan.equipment,
      status: newLoan.status,
    });

    // 🔔 NOTIFICACIÓN: Buscar líderes para aprobación
    const leaders = await this.prisma.user.findMany({
      where: {
        role: 'LEADER',
        isLeader: true,
      },
    });

    if (leaders.length > 0) {
      const leaderIds = leaders.map((l) => l.userId);
      this.gateway.notifyLeadersPendingApproval(leaderIds, {
        equipmentLoanId: newLoan.equipmentLoanId,
        user: newLoan.user,
        equipment: newLoan.equipment,
        reason: newLoan.reason,
      });
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

    // 🔔 NOTIFICACIÓN: Cambio de estado del préstamo
    this.gateway.notifyStatusChange(
      loan.userId,
      updatedLoan.equipmentLoanId,
      status,
      updatedLoan.equipment.name,
    );

    // Si fue aprobado, notificar al usuario
    if (status === LoanStatus.APPROVED) {
      this.gateway.notifyUser(loan.userId, 'loan:approved', {
        loanId: updatedLoan.equipmentLoanId,
        equipmentName: updatedLoan.equipment.name,
        message: '¡Tu solicitud de préstamo ha sido aprobada!',
        timestamp: new Date().toISOString(),
      });
    }

    // Si fue rechazado, notificar al usuario
    if (status === LoanStatus.REJECTED) {
      this.gateway.notifyUser(loan.userId, 'loan:rejected', {
        loanId: updatedLoan.equipmentLoanId,
        equipmentName: updatedLoan.equipment.name,
        message: 'Tu solicitud de préstamo ha sido rechazada',
        timestamp: new Date().toISOString(),
      });
    }

    // Si fue devuelto, notificar al usuario
    if (status === LoanStatus.RETURNED) {
      this.gateway.notifyUser(loan.userId, 'loan:returned', {
        loanId: updatedLoan.equipmentLoanId,
        equipmentName: updatedLoan.equipment.name,
        message: 'El equipo ha sido devuelto exitosamente',
        timestamp: new Date().toISOString(),
      });
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

    // 🔔 NOTIFICACIÓN: Préstamo cancelado
    this.gateway.notifyStatusChange(
      userId,
      cancelledLoan.equipmentLoanId,
      LoanStatus.CANCELLED,
      loan.equipment?.name || 'Equipo',
    );

    return cancelledLoan;
  }

  // ===== UBICACIONES =====
  async findAllLocations() {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
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
      [LoanStatus.APPROVED]: [LoanStatus.LOANED, LoanStatus.CANCELLED],
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
