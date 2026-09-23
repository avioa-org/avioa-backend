import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { FiltrosNominaDto } from './dto/filtros-nomina.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { ExportarNominaDto } from './dto/exportar-nomina.dto';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { NominaExportService } from './nomina-export.service';
import { type Response } from 'express';

@Controller('nomina')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class NominaController {
  constructor(
    private readonly nominaService: NominaService,
    private readonly nominaExportService: NominaExportService,
  ) {}

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

  @Get('novedades/export')
  @RequireModule(Modules.NOMINA)
  async exportarExcel(
    @Query() filtros: ExportarNominaDto,
    @CurrentUser('name') name: string,
    @Res() res: Response,
  ) {
    const workbook = await this.nominaExportService.generarWorkbook(
      filtros,
      name,
    );

    const nombreArchivo = `novedades_nomina_${filtros.desde}_a_${filtros.hasta}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="novedades_nomina.xlsx"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
