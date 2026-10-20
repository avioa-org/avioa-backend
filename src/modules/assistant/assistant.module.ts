import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LeavesModule } from '../leaves/leaves.module';
import { NominaModule } from '../nomina/nomina.module';

@Module({
  imports: [LeavesModule, NominaModule],
  controllers: [AssistantController],
  providers: [AssistantService, PrismaService],
})
export class AssistantModule {}
