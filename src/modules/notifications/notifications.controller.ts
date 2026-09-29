import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
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

  @Get('unseen-count')
  unseenCount(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getUnseenCount(userId);
  }

  @Patch('read/:notificationId')
  async markNotificationAsRead(
    @Param('notificationId') notificationId: string,
  ) {
    return await this.notificationsService.markNotificationAsRead(
      notificationId,
    );
  }

  @Patch('seen/:id')
  markSeen(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.notificationsService.markAsSeen(id, userId);
  }

  @Patch('read-all')
  async markAllNotificationsAsRead(@CurrentUser('userId') userId: string) {
    return await this.notificationsService.markAllNotificationsAsRead(userId);
  }

  @Patch('read/:id')
  markRead(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('seen-all')
  markAllSeen(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllAsSeen(userId);
  }

  @Delete(':id')
  dismiss(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.notificationsService.dismiss(id, userId);
  }
}
