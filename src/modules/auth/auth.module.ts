import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config/env.config';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.infra';
import type { StringValue } from 'ms';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService, EmailService],
  imports: [
    JwtModule.register({
      secret: envs.JWT_SECRET,
      signOptions: { expiresIn: (envs.JWT_EXPIRES_IN as StringValue) ?? '30m' },
    }),
  ],
})
export class AuthModule {}
