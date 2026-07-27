import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GmailService } from 'src/modules/google/gmail/gmail.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly gmailService: GmailService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    try {
      await this.gmailService.scan();
    } catch (err) {
      this.logger.error(
        'Error en cron de escaneo de correos',
        (err as Error).stack,
      );
    }
  }
}
