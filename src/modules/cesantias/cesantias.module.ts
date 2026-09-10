import { Module } from '@nestjs/common';
import { CesantiasService } from './cesantias.service';
import { CesantiasController } from './cesantias.controller';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { StorageModule } from 'src/infrastructure/storage/storage.module';

@Module({
  controllers: [CesantiasController],
  providers: [CesantiasService, PrismaService, EmailService],
  imports: [StorageModule],
})
export class CesantiasModule {}
