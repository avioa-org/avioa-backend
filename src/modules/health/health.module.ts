import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    BullModule.registerQueue({ name: 'pago-total' }),
  ],
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class HealthModule {}
