import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EquipmentDto, EquipmentStatus } from './dto/equipment.dto';
import { LoanDto, LoanStatus } from './dto/loan.dto';

@Injectable()
export class EquipmentLoansService {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { id },
      include: { location: true, loans: true },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    return equipment;
  }

  async updateEquipment(id: string, data: EquipmentDto) {
    await this.findOneEquipment(id);
    const cleanData = this.cleanObject(data);
    return this.prisma.equipment.update({
      where: { id },
      data: cleanData as any,
      include: { location: true },
    });
  }

  async deleteEquipment(id: string) {
    const equipment = await this.findOneEquipment(id);
    const activeLoans = equipment.loans.filter(
      (l) => l.status === LoanStatus.LOANED || l.status === LoanStatus.PENDING
    );
    if (activeLoans.length > 0) {
      throw new BadRequestException('Cannot delete equipment with active loans');
    }
    return this.prisma.equipment.delete({ where: { id } });
  }

  // ===== PRÉSTAMOS =====
  async createLoan(userId: string, data: LoanDto) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: data.equipmentId },
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

    return this.prisma.equipmentLoan.create({
      data: loanData,
      include: { equipment: { include: { location: true } }, user: true },
    });
  }

  async findMyLoans(userId: string) {
    return this.prisma.equipmentLoan.findMany({
      where: { userId },
      include: { equipment: { include: { location: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }



async findAllLoans(filters?: { status?: LoanStatus; userId?: string; equipmentId?: string }) {
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
      where: { id },
      include: { equipment: { include: { location: true } }, user: true, approvedBy: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async updateLoanStatus(id: string, status: LoanStatus, userId?: string) {
    const loan = await this.findOneLoan(id);
    
    // Si se aprueba, cambiar estado del equipo
    if (status === LoanStatus.APPROVED) {
      await this.prisma.equipment.update({
        where: { id: loan.equipmentId },
        data: { status: EquipmentStatus.LOANED },
      });
    }
    
    // Si se devuelve, cambiar estado del equipo
    if (status === LoanStatus.RETURNED) {
      await this.prisma.equipment.update({
        where: { id: loan.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });
    }

    return this.prisma.equipmentLoan.update({
      where: { id },
      data: { 
        status, 
        approvedById: userId,
        actualReturnDate: status === LoanStatus.RETURNED ? new Date() : undefined
      },
      include: { equipment: { include: { location: true } }, user: true },
    });
  }

  async cancelLoan(id: string, userId: string) {
    const loan = await this.findOneLoan(id);
    if (loan.userId !== userId) {
      throw new BadRequestException('You can only cancel your own loans');
    }
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException('Only pending loans can be cancelled');
    }
    return this.prisma.equipmentLoan.update({
      where: { id },
      data: { status: LoanStatus.CANCELLED },
    });
  }

  // ===== UBICACIONES =====
  async findAllLocations() {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}