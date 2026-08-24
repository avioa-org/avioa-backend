import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { ConfigService } from '@nestjs/config';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';
import { GmailService } from 'src/modules/google/gmail/gmail.service';
import { BullModule } from '@nestjs/bullmq';
import { PasswordVaultService } from 'src/modules/password-vault/password-vault.service';
import { PasswordVaultModule } from 'src/modules/password-vault/password-vault.module';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { TwoFactorService } from 'src/infrastructure/two-factor/two-factor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    BullModule.registerQueue({ name: 'hotel-payment-alerts' }),
    PasswordVaultModule,
  ],
  providers: [
    CronService,
    ConfigService,
    EvolutionApiService,
    PrismaService,
    GmailService,
    PasswordVaultService,
    EncryptionService,
    TwoFactorService,
  ],
  exports: [CronService],
})
export class CronModule {}
