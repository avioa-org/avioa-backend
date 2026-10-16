import { Controller, Get } from '@nestjs/common';
import { VuelosService } from './vuelos.service';

@Controller('vuelos')
export class VuelosController {
  constructor(private readonly vuelosService: VuelosService) {}

  @Get('mejores-del-dia')
  getMejoresDelDia() {
    return this.vuelosService.getMejoresDelDia();
  }
}
