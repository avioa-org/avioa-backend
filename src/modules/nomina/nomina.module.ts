import { Module } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { NominaController } from './nomina.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NominaExportService } from './nomina-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [NominaController],
  providers: [NominaService, NominaExportService],
  exports: [NominaService, NominaExportService],
})
export class NominaModule {}
