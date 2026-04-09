import { Module } from '@nestjs/common';
import { QueueModule } from './infrastructure/queue/queue.module';
import { CronModule } from './jobs/cron.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PagoTotalModule } from './modules/pago-total/pago-total.module';
import { BullModule } from '@nestjs/bullmq';
import { envs } from './config/env.config';
import { HealthModule } from './modules/health/health.module';
import { AlertaReservasModule } from './modules/alerta-reservas/alerta-reservas.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    CronModule,
    PrismaModule,
    PagoTotalModule,
    BullModule.forRoot({
      connection: {
        host: envs.REDIS_HOST || 'localhost',
        port: Number(envs.REDIS_PORT) || 6379,
      },
    }),
    HealthModule,
    AlertaReservasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
