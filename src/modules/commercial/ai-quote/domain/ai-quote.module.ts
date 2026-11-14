import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { AiQuoteService } from './ai-quote.service';
import { GoogleSheetClient } from '../../../flight-blockings/google-sheet.client';

@Module({
  imports: [PrismaModule],
  providers: [AiQuoteService, GoogleSheetClient],
  exports: [AiQuoteService],
})
export class AiQuoteModule {}