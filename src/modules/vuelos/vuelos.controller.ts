import { Controller, Get, Query } from '@nestjs/common';
import { VuelosService } from './vuelos.service';
import { FiltroVuelosDto } from './dto/filtros-vuelos.dto';

@Controller('vuelos')
export class VuelosController {
  constructor(private readonly vuelosService: VuelosService) {}

  @Get('mejores-del-dia')
  getMejoresDelDia() {
    return this.vuelosService.getMejoresDelDia();
  }

  @Get('ofertas')
  getOfertas(@Query() filtros: FiltroVuelosDto) {
    return this.vuelosService.getOfertas(filtros);
  }
}
