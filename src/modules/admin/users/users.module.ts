import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.infra';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, EmailService],
})
export class UsersModule {}
