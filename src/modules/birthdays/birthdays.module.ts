import { Module } from '@nestjs/common';
import { BirthdaysService } from './birthdays.service';
import { BirthdaysController } from './birthdays.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { FeedGateway } from '../feed/feed.gateway';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [BirthdaysController],
  providers: [
    BirthdaysService,
    PrismaService,
    FeedService,
    FeedGateway,
    JwtService,
  ],
})
export class BirthdaysModule {}
