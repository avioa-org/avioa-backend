import { Module } from '@nestjs/common';
import { AuxiliaryService } from './auxiliary.service';
import { AuxiliaryController } from './auxiliary.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { StorageService } from 'src/infrastructure/storage/storage.service';

@Module({
  controllers: [AuxiliaryController],
  providers: [
    AuxiliaryService,
    PrismaService,
    EncryptionService,
    StorageService,
  ],
})
export class AuxiliaryModule {}
