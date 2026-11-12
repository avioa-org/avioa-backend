import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config/env.config';
import { FeedGateway } from './feed.gateway';
import { StorageModule } from 'src/infrastructure/storage/storage.module';

@Module({
  imports: [
    JwtModule.register({
      secret: envs.JWT_SECRET,
    }),
    StorageModule,
  ],
  controllers: [FeedController],
  providers: [FeedService, PrismaService, FeedGateway],
  exports: [FeedService, FeedGateway],
})
export class FeedModule {}
