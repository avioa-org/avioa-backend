import { Module } from '@nestjs/common';
import { GmailProcessorModule } from './modules/monitoreo-reservas/monitoreo-reservas.module';
import { ConfirmacionPagoTotalModule } from './modules/confirmacion-pago-total/confirmacion-pago-total.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { CronModule } from './jobs/cron.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GmailProcessorModule,
    ConfirmacionPagoTotalModule,
    QueueModule,
    CronModule,
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
