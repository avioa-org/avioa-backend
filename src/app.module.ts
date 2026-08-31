import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { PointsModule } from './modules/points/points.module';
import { OvertimeModule } from './modules/overtime/overtime.module';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';
import { FormsModule } from './modules/forms/forms.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { GoogleModule } from './modules/google/google.module';
import { PasswordVaultModule } from './modules/password-vault/password-vault.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FeedModule } from './modules/feed/feed.module';
import { CotizadorModule } from './modules/cotizador/cotizador.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
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
    WebsocketsModule,
    AuthModule,
    UsersModule,
    PointsModule,
    OvertimeModule,
    FormsModule,
    LeavesModule,
    GoogleModule,
    PasswordVaultModule,
    NotificationsModule,
    FeedModule,
    CotizadorModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HttpThrottlerGuard,
    },
  ],
})
export class AppModule {}
