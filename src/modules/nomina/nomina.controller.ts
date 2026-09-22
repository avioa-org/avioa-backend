import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'generated/prisma/enums';
import { FiltrosNominaDto } from './dto/filtros-nomina.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('nomina')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}

  @Get('novedades')
  @RequireModule(Modules.NOMINA)
  consolidar(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.consolidar(filtros);
  }

  @Get('novedades/por-colaborador')
  @RequireModule(Modules.NOMINA)
  porColaborador(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.resumenPorColaborador(filtros);
  }

  @Get('novedades/totales')
  @RequireModule(Modules.NOMINA)
  totales(@Query() filtros: FiltrosNominaDto) {
    return this.nominaService.totalesPeriodo(filtros);
  }
}
