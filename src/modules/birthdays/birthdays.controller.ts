import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BirthdaysService } from './birthdays.service';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('birthdays')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class BirthdaysController {
  constructor(private readonly birthdayService: BirthdaysService) {}

  @Get('me')
  getMyStatus(@CurrentUser('userId') userId: string) {
    return this.birthdayService.getMyBirthdayStatus(userId);
  }

  @Post('me/seen')
  markSeen(@CurrentUser('userId') userId: string) {
    return this.birthdayService.markCelebrationSeen(userId);
  }

  @Post('run-now')
  @RequireModule(Modules.BIRTHDAYS)
  runNow() {
    return this.birthdayService.generateBirthdayPostsForToday();
  }
}
