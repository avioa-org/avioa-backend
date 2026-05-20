import { Module } from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { OvertimeLeaderGuard } from './overtime-leader.guard.';
import { EmailService } from 'src/infrastructure/email/email.infra';

@Module({
  controllers: [OvertimeController],
  providers: [
    OvertimeService,
    PrismaService,
    OvertimeLeaderGuard,
    EmailService,
  ],
  exports: [OvertimeService],
})
export class OvertimeModule {}
