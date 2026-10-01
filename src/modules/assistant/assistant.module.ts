import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LeavesModule } from '../leaves/leaves.module';

@Module({
  imports: [LeavesModule],
  controllers: [AssistantController],
  providers: [AssistantService, PrismaService],
})
export class AssistantModule {}
