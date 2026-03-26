import { Module } from '@nestjs/common';
import { MonitoreoReservasService } from './monitoreo-reservas.service';
import { MonitoreoReservasController } from './monitoreo-reservas.controller';
import { GmailService } from 'src/infrastructure/gmail/gmail.infra';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [MonitoreoReservasController],
  providers: [MonitoreoReservasService, GmailService, ConfigService],
})
export class GmailProcessorModule {}
