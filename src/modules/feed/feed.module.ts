import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config/env.config';
import { FeedGateway } from './feed.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: envs.JWT_SECRET,
    }),
  ],
  controllers: [FeedController],
  providers: [FeedService, PrismaService, FeedGateway],
  exports: [FeedService],
})
export class FeedModule {}
