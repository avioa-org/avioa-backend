import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { GmailInfraService } from 'src/infrastructure/gmail-infra/gmail.infra';
import { ConfigService } from '@nestjs/config';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  providers: [
    CronService,
    GmailInfraService,
    ConfigService,
    EvolutionApiService,
    PrismaService,
  ],
  exports: [CronService],
})
export class CronModule {}
