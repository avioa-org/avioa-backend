import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, PrismaService],
})
export class KnowledgeModule {}
