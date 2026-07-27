import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { ConfigService } from '@nestjs/config';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';
import { GmailService } from 'src/modules/google/gmail/gmail.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    BullModule.registerQueue({ name: 'hotel-payment-alerts' }),
  ],
  providers: [
    CronService,
    ConfigService,
    EvolutionApiService,
    PrismaService,
    GmailService,
  ],
  exports: [CronService],
})
export class CronModule {}
