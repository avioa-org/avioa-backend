import { Controller, Get } from '@nestjs/common';
import { MonitoreoReservasService } from './monitoreo-reservas.service';

@Controller('monitoreo-reservas')
export class MonitoreoReservasController {
  constructor(
    private readonly monitoreoReservasService: MonitoreoReservasService,
  ) {}

  @Get('procesar')
  async procesarAlertas() {
    return await this.monitoreoReservasService.procesarAlertas();
  }
}
