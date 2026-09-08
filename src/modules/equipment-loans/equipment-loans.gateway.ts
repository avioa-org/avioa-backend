import { Injectable } from '@nestjs/common';
import { SocketGateway } from 'src/modules/points/gateway/points.gateway';

@Injectable()
export class EquipmentLoansGateway {
  constructor(private readonly socketGateway: SocketGateway) {}

  // Notificar al usuario sobre su préstamo
  notifyUser(userId: string, event: string, data: any) {
    this.socketGateway.notifyEmployee(userId, event, data);
  }

  // Notificar a un líder específico
  notifyLeader(leaderId: string, event: string, data: any) {
    this.socketGateway.notifyLeader(leaderId, event, data);
  }

  // Notificar nueva solicitud de préstamo
  notifyNewLoan(userId: string, loanData: any) {
    this.socketGateway.notifyEmployee(userId, 'loan:newRequest', {
      loanId: loanData.equipmentLoanId,
      equipmentName: loanData.equipment?.name || 'Equipo',
      status: loanData.status,
      message: 'Tu solicitud de préstamo ha sido creada exitosamente',
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar cambio de estado del préstamo
  notifyStatusChange(userId: string, loanId: string, status: string, equipmentName: string) {
    const messages = {
      APPROVED: 'Tu solicitud de préstamo ha sido APROBADA',
      REJECTED: 'Tu solicitud de préstamo ha sido RECHAZADA',
      LOANED: 'El equipo te ha sido ENTREGADO',
      RETURNED: 'El equipo ha sido DEVUELTO exitosamente',
      PENDING: 'Tu solicitud está PENDIENTE de revisión',
      CANCELLED: 'Tu solicitud ha sido CANCELADA',
    };

    this.socketGateway.notifyEmployee(userId, 'loan:statusChange', {
      loanId,
      status,
      equipmentName,
      message: messages[status] || `Estado del préstamo: ${status}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar a líderes sobre nueva solicitud pendiente
  notifyLeadersPendingApproval(leaderIds: string[], loanData: any) {
    if (!leaderIds || leaderIds.length === 0) return;

    leaderIds.forEach(leaderId => {
      this.socketGateway.notifyLeader(leaderId, 'loan:pendingApproval', {
        loanId: loanData.equipmentLoanId,
        userName: loanData.user?.name || 'Usuario',
        equipmentName: loanData.equipment?.name || 'Equipo',
        reason: loanData.reason || 'Sin motivo especificado',
        message: 'Hay una nueva solicitud de préstamo pendiente de aprobación',
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Notificar a administradores (opcional)
  notifyAdmins(admins: string[], event: string, data: any) {
    admins.forEach(adminId => {
      this.socketGateway.notifyEmployee(adminId, event, data);
    });
  }
}