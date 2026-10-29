import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AuxiliaryOperationalController } from './auxiliary-operational.controller';
import { AuxiliaryOperationalService } from './auxiliary-operational.service';
import { AuxiliaryChatController } from './auxiliary-chat.controller';
import { AuxiliaryChatService } from './auxiliary-chat.service';
import { AuxiliaryOpenAiService } from './auxiliary-openai.service';
import { AuxiliaryDocumentAiController } from './auxiliary-document-ai.controller';
import { AuxiliaryDocumentAiService } from './auxiliary-document-ai.service';
import { SqlDatabase } from './postgres.repository';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    AuxiliaryChatController,
    AuxiliaryDocumentAiController,
    AuxiliaryOperationalController,
  ],
  providers: [
    AuxiliaryChatService,
    AuxiliaryDocumentAiService,
    AuxiliaryOpenAiService,
    AuxiliaryOperationalService,
    SqlDatabase,
  ],
})
export class AuxiliaryOperationalModule {}
