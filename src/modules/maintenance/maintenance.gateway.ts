import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from '../points/gateway/points.gateway';

@Injectable()
export class MaintenanceGateway {
  private readonly logger = new Logger(MaintenanceGateway.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  async notifyUser(userId: string, event: string, data: any) {
    await this.socketGateway.notifyEmployee(userId, event, data);
  }

  async notifyNewRequest(userId: string, data: any) {
    await this.socketGateway.notifyEmployee(userId, 'maintenance:newRequest', {
      maintenanceRequestId: data.maintenanceRequestId,
      equipmentName: data.equipmentName,
      status: data.status,
      message: 'Tu solicitud de mantenimiento ha sido creada exitosamente',
      timestamp: new Date().toISOString(),
    });
  }

  async notifySupportNewRequest(supportId: string, data: any) {
    await this.socketGateway.notifyEmployee(
      supportId,
      'maintenance:pendingApproval',
      {
        maintenanceRequestId: data.maintenanceRequestId,
        userName: data.userName,
        equipmentName: data.equipmentName,
        reason: data.reason,
        message: 'Hay una nueva solicitud de mantenimiento pendiente',
        timestamp: new Date().toISOString(),
      },
    );
  }

  async notifyStatusChange(
    userId: string,
    maintenanceRequestId: string,
    status: string,
    equipmentName: string,
  ) {
    const messages: Record<string, string> = {
      PENDING: 'Tu solicitud de mantenimiento está pendiente',
      IN_REVIEW: 'Tu solicitud de mantenimiento está en revisión',
      IN_PROGRESS: 'Tu solicitud de mantenimiento está en proceso',
      RESOLVED: 'Tu solicitud de mantenimiento ha sido resuelta',
      REJECTED: 'Tu solicitud de mantenimiento ha sido rechazada',
      CANCELLED: 'Tu solicitud de mantenimiento ha sido cancelada',
    };

    await this.socketGateway.notifyEmployee(userId, 'maintenance:statusChange', {
      maintenanceRequestId,
      status,
      equipmentName,
      message: messages[status] || `Estado: ${status}`,
      timestamp: new Date().toISOString(),
    });
  }
}