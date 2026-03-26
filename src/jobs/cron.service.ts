import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OperacionesQueue } from 'src/modules/monitoreo-reservas/queue/operaciones.queue';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private operacionesQueue: OperacionesQueue) {}

  @Cron(CronExpression.EVERY_5_MINUTES) // Cada 5 minutos
  async handleCron() {
    this.logger.debug('Se ejecuta el cron');
    await this.operacionesQueue.addProcessarOperacionesJob();
  }
}
