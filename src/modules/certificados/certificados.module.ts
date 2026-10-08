import { Module } from '@nestjs/common';
import { CertificadosService } from './certificados.service';
import { CertificadosController } from './certificados.controller';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { BullModule } from '@nestjs/bullmq';
import { CertificadosProcessor } from './certificados.processor';

@Module({
  controllers: [CertificadosController],
  providers: [
    CertificadosService,
    StorageService,
    PrismaService,
    EncryptionService,
    CertificadosProcessor,
  ],
  imports: [
    BullModule.registerQueue({
      name: 'certificados',
    }),
  ],
})
export class CertificadosModule {}
