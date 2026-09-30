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
    if (envs.CRON_ACTIVE && envs.CRON_ACTIVE === 'false') {
      this.logger.debug('Gmail scan cron is inactive (CRON_ACTIVE=false)');
      return;
    }

    const startTime = Date.now();
    this.logger.log('Starting scheduled Gmail scan cron...');

    try {
      await this.gmailService.scan();
      const duration = Date.now() - startTime;
      this.logger.log(`Scheduled Gmail scan cron completed in ${duration}ms`);
    } catch (err) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Gmail scan cron failed after ${duration}ms: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handlePurgeExpiredPasswords() {
    const startTime = Date.now();
    this.logger.log('Starting daily purge of expired vault passwords...');

    try {
      await this.passwordVaultService.purgeExpiredTrash();
      const duration = Date.now() - startTime;
      this.logger.log(
        `Expired vault passwords purge completed in ${duration}ms`,
      );
    } catch (err) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Purge expired passwords cron failed after ${duration}ms: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
