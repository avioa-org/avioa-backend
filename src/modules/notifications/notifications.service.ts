import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log(`Retrieved ${notifications.length} notifications`);

    return {
      notifications,
      unread: notifications.filter((n) => !n.read).length,
    };
  }

  async markNotificationAsRead(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        notificationId,
      },
    });

    if (!notification) {
      this.logger.error(`Notification with id ${notificationId} not found`);
      throw new NotFoundException('La notificación no fue encontrada');
    }

    return await this.prisma.notification.update({
      where: {
        notificationId,
      },
      data: {
        read: true,
      },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return await this.prisma.notification.updateMany({
      where: {
        userId,
      },
      data: {
        read: true,
      },
    });
  }
}
