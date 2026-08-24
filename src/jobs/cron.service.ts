import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { envs } from 'src/config/env.config';
import { GmailService } from 'src/modules/google/gmail/gmail.service';
import { PasswordVaultService } from 'src/modules/password-vault/password-vault.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly gmailService: GmailService,
    private readonly passwordVaultService: PasswordVaultService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    try {
      if (envs.CRON_ACTIVE && envs.CRON_ACTIVE === 'false') return;
      await this.gmailService.scan();
    } catch (err) {
      this.logger.error(
        `Error en cron de escaneo de correos: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handlePurgeExpiredPasswords() {
    await this.passwordVaultService.purgeExpiredTrash();
  }
}
