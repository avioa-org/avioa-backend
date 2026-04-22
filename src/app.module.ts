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
import { DocumentsModule } from './modules/documents/documents.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/admin/users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    CronModule,
    PrismaModule,
    PagoTotalModule,
    BullModule.forRoot({
      connection: {
        url: envs.REDIS_URL,
      },
    }),
    HealthModule,
    AlertaReservasModule,
    DocumentsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
