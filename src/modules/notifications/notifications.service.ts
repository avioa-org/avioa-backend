import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationType } from 'generated/prisma/enums';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { SocketGateway } from '../points/gateway/points.gateway';

interface CreateNotificationInput {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  event?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketGateway: SocketGateway,
  ) {}

  async getNotifications(userId: string) {
    // const notifications = await this.prisma.notification.findMany({
    //   where: {
    //     userId,
    //   },
    //   orderBy: {
    //     createdAt: 'desc',
    //   },
    // });

    // this.logger.log(`Retrieved ${notifications.length} notifications`);

    // return {
    //   notifications,
    //   unread: notifications.filter((n) => !n.read).length,
    // };
    const [notifications, unseen] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, dismissedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, seenAt: null, dismissedAt: null },
      }),
    ]);

    return {
      notification: notifications.map((n) => this.toClient(n)),
      unread: unseen,
    };
  }

  async getUnseenCount(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, seenAt: null, dismissedAt: null },
    });
    return { unread };
  }

  async markAsSeen(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { notificationId, userId },
    });

    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (notif.seenAt) return this.toClient(notif);

    const updated = await this.prisma.notification.update({
      where: { notificationId },
      data: { seenAt: new Date() },
    });

    await this.emitBadge(userId);
    return this.toClient(updated);
  }

  async markAllAsSeen(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, seenAt: null, dismissedAt: null },
      data: { seenAt: new Date() },
    });

    await this.emitBadge(userId);
    return { updated: result.count };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { notificationId, userId },
    });

    if (!notif) throw new NotFoundException('Notificación no encontrada');

    const now = new Date();
    const updated = await this.prisma.notification.update({
      where: { notificationId },
      data: {
        readAt: now,
        seenAt: notif.seenAt ?? now, // si no la haboa visto, tambien
      },
    });

    await this.emitBadge(userId);
    return this.toClient(updated);
  }

  async markAllAsRead(userId: string) {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, dismissedAt: null },
      data: { readAt: now, seenAt: now },
    });

    await this.emitBadge(userId);
    return { success: true };
  }

  async dismiss(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { notificationId, userId },
      data: { dismissedAt: new Date() },
    });
    return { success: true };
  }

  async createAndNotify(input: CreateNotificationInput) {
    if (input.actorId && input.actorId === input.userId) {
      this.logger.debug(`Self-notification skipped for ${input.userId}`);
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        priority: input.priority ?? NotificationPriority.NORMAL,
        metadata: input.metadata ?? {},
      },
    });

    const payload = this.toClient(notification);

    await this.socketGateway.notifyUser(
      input.userId,
      input.event ?? 'notification:new',
      payload,
    );

    await this.emitBadge(input.userId);

    return payload;
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

  private async emitBadge(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, seenAt: null, dismissedAt: null },
    });

    await this.socketGateway.notifyUser(userId, 'notification:badge', {
      unread,
    });
  }

  private toClient(n: any) {
    return {
      notificationId: n.notificationId,
      userId: n.userId,
      actorId: n.actorId,
      title: n.title,
      message: n.message,
      type: n.type,
      entityType: n.entityType,
      entityId: n.entityId,
      priority: n.priority,

      ...(n.metadata ?? {}),
      metadata: n.metadata ?? {},

      // Estados nuevos
      isSeen: n.seenAt != null,
      isRead: n.readAt != null,
      seenAt: n.seenAt,
      readAt: n.readAt,

      createdAt: n.createdAt,
      receivedAt: n.createdAt,
    };
  }
}
