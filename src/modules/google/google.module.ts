import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { GmailService } from './gmail/gmail.service';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [GoogleController],
  providers: [GoogleService, GmailService, EvolutionApiService, PrismaService],
  imports: [
    BullModule.registerQueue({ name: 'hotel-payment-alerts' }),
    HttpModule,
  ],
})
export class GoogleModule {}
