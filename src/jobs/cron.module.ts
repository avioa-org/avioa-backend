import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { OperacionesQueue } from 'src/modules/monitoreo-reservas/queue/operaciones.queue';
import { OperacionesWorker } from 'src/modules/monitoreo-reservas/workers/operaciones.worker';
import { MonitoreoReservasService } from 'src/modules/monitoreo-reservas/monitoreo-reservas.service';
import { GmailService } from 'src/infrastructure/gmail/gmail.infra';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    CronService,
    OperacionesQueue,
    OperacionesWorker,
    MonitoreoReservasService,
    GmailService,
    ConfigService,
  ],
  exports: [CronService],
})
export class CronModule {}
