import { Module } from '@nestjs/common';
import { BirthdaysService } from './birthdays.service';
import { BirthdaysController } from './birthdays.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { FeedModule } from '../feed/feed.module';

@Module({
  controllers: [BirthdaysController],
  imports: [FeedModule],
  providers: [BirthdaysService, PrismaService],
})
export class BirthdaysModule {}
