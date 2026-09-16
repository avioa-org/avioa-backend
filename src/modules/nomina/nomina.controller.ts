import { Controller, Get, Query } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'generated/prisma/enums';
import { FiltrosNominaDto } from './dto/filtros-nomina.dto';

@Controller('nomina')
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}

  @Get('novedades')
  @Roles(Role.ADMIN)
  consolidar(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.consolidar(filtros);
  }

  @Get('novedades/por-colaborador')
  @Roles(Role.ADMIN)
  porColaborador(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.resumenPorColaborador(filtros);
  }

  @Get('novedades/totales')
  @Roles(Role.ADMIN)
  totales(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.totalesPeriodo(filtros);
  }
}
