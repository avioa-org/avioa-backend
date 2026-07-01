import { Module } from '@nestjs/common';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [GoogleAuthController],
  providers: [GoogleAuthService, PrismaService],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
