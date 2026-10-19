import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CloudinaryService } from 'src/infrastructure/cloudinary/cloudinary.infra';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaService,
    EmailService,
    CloudinaryService,
    EncryptionService,
  ],
  imports: [NestjsFormDataModule, PrismaModule],
})
export class UsersModule {}
