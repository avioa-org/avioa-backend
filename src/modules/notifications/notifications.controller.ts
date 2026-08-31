import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('all')
  async getNotifications(@CurrentUser('userId') userId: string) {
    return await this.notificationsService.getNotifications(userId);
  }

  @Patch('read/:notificationId')
  async markNotificationAsRead(
    @Param('notificationId') notificationId: string,
  ) {
    return await this.notificationsService.markNotificationAsRead(
      notificationId,
    );
  }

  @Patch('read-all')
  async markAllNotificationsAsRead(@CurrentUser('userId') userId: string) {
    return await this.notificationsService.markAllNotificationsAsRead(userId);
  }
}
