import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { LeaveLeaderGuard } from './guards/leave-leader.guard';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [LeavesController],
  providers: [LeavesService, PrismaService, LeaveLeaderGuard, EmailService],
  exports: [LeavesService],
})
export class LeavesModule {}
