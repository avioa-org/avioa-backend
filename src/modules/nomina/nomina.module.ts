import { Module } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { NominaController } from './nomina.controller';

@Module({
  controllers: [NominaController],
  providers: [NominaService],
})
export class NominaModule {}
