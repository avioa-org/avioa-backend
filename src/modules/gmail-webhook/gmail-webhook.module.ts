import { Module } from '@nestjs/common';
import { GmailWebhookService } from './gmail-webhook.service';
import { GmailWebhookController } from './gmail-webhook.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [GmailWebhookController],
  providers: [GmailWebhookService, PrismaService],
})
export class GmailWebhookModule {}
