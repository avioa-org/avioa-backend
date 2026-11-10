import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { AiQuoteService } from './ai-quote.service';

@Module({
  imports: [PrismaModule],
  providers: [AiQuoteService],
  exports: [AiQuoteService],
})
export class AiQuoteModule {}