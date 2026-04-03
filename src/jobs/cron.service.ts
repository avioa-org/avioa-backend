import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor() {}

  // @Cron(CronExpression.EVERY_5_MINUTES) // Cada 5 minutos
  // async handleCron() {
  //   // await this.operacionesQueue.addProcessarOperacionesJob();
  // }
}
