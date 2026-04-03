import { Module } from '@nestjs/common';
import { QueueModule } from './infrastructure/queue/queue.module';
import { CronModule } from './jobs/cron.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { PagoTotalModule } from './modules/pago-total/pago-total.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    CronModule,
    PrismaModule,
    GmailModule,
    PagoTotalModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
