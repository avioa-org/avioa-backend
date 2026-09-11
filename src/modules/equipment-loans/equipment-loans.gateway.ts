// backend/src/modules/equipment-loans/equipment-loans.gateway.ts

import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from 'src/modules/points/gateway/points.gateway';

@Injectable()
export class EquipmentLoansGateway {
  private readonly logger = new Logger(EquipmentLoansGateway.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  async notifyUser(userId: string, event: string, data: any) {
    await this.socketGateway.notifyEmployee(userId, event, data);
  }

  async notifyLeader(leaderId: string, event: string, data: any) {
    await this.socketGateway.notifyLeader(leaderId, event, data);
  }

  async notifyNewLoan(userId: string, loanData: any) {
    await this.socketGateway.notifyEmployee(userId, 'loan:newRequest', {
      loanId: loanData.equipmentLoanId,
      equipmentName: loanData.equipment?.name || 'Equipo',
      status: loanData.status,
      message: 'Tu solicitud de préstamo ha sido creada exitosamente',
      timestamp: new Date().toISOString(),
    });
  }

  async notifyStatusChange(
    userId: string,
    loanId: string,
    status: string,
    equipmentName: string,
  ) {
    const messages: Record<string, string> = {
      APPROVED: 'Tu solicitud de préstamo ha sido APROBADA',
      REJECTED: 'Tu solicitud de préstamo ha sido RECHAZADA',
      LOANED: 'El equipo te ha sido ENTREGADO',
      RETURNED: 'El equipo ha sido DEVUELTO exitosamente',
      PENDING: 'Tu solicitud está PENDIENTE de revisión',
      CANCELLED: 'Tu solicitud ha sido CANCELADA',
    };

    await this.socketGateway.notifyEmployee(userId, 'loan:statusChange', {
      loanId,
      status,
      equipmentName,
      message: messages[status] || `Estado del préstamo: ${status}`,
      timestamp: new Date().toISOString(),
    });
  }

  async notifyLeadersPendingApproval(leaderIds: string[], loanData: any) {
    if (!leaderIds || leaderIds.length === 0) {
      this.logger.warn('No hay líderes para notificar');
      return;
    }

    this.logger.log(`Notificando a ${leaderIds.length} aprobadores`);

    await Promise.all(
      leaderIds.map((leaderId) =>
        this.socketGateway.notifyLeader(leaderId, 'loan:pendingApproval', {
          loanId: loanData.equipmentLoanId,
          userName: loanData.user?.name || 'Usuario',
          equipmentName: loanData.equipment?.name || 'Equipo',
          reason: loanData.reason || 'Sin motivo especificado',
          message: 'Hay una nueva solicitud de préstamo pendiente de aprobación',
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  async notifyAdmins(admins: string[], event: string, data: any) {
    await Promise.all(
      admins.map((adminId) => this.socketGateway.notifyEmployee(adminId, event, data)),
    );
  }
}