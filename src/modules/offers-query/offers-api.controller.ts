import { Controller, Get, Header, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { OffersQueryService } from './offers-query.service';
import { OffersApiGuard } from './offers-api.guard';
import { OffersApiFilter } from './offers-api.filter';
const openapi = require('./openapi.json');

@Controller('ofertas-api')
@UseGuards(OffersApiGuard)
@UseFilters(OffersApiFilter)
export class OffersApiController {
  constructor(private readonly offers: OffersQueryService) {}
  @Header('Cache-Control', 'no-store')
  @Get('health') health() { return { ok: true, version: '1.0.0', mode: 'read_only' }; }
  @Header('Cache-Control', 'no-store')
  @Get('openapi.json') contract() { return openapi; }
  @Header('Cache-Control', 'no-store')
  @Get('ofertas') search(@Query() q: Record<string, string>) { return this.offers.search(q); }
  @Header('Cache-Control', 'no-store')
  @Get('destinos') destinations(@Query() q: Record<string, string>) { return this.offers.context(q, 'destinos'); }
  @Header('Cache-Control', 'no-store')
  @Get('origenes') origins(@Query() q: Record<string, string>) { return this.offers.context(q, 'origenes'); }
  @Header('Cache-Control', 'no-store')
  @Get('hoteles') hotels(@Query() q: Record<string, string>) { return this.offers.context(q, 'hoteles'); }
  @Header('Cache-Control', 'no-store')
  @Get('hoteles/:id/politicas') hotelPolicies(@Param('id') id: string, @Query() q: Record<string, string>) { return this.offers.hotelPolicies(id, q); }
  @Header('Cache-Control', 'no-store')
  @Get('contexto') context(@Query() q: Record<string, string>) { return this.offers.context(q); }
  @Header('Cache-Control', 'no-store')
  @Get('ofertas/:id/fechas') dates(@Param('id') id: string, @Query() q: Record<string, string>) { return this.offers.detail(id, q, 'fechas'); }
  @Header('Cache-Control', 'no-store')
  @Get('ofertas/:id/mensaje') message(@Param('id') id: string, @Query() q: Record<string, string>) { return this.offers.detail(id, q, 'mensaje'); }
  @Header('Cache-Control', 'no-store')
  @Get('ofertas/:id') detail(@Param('id') id: string, @Query() q: Record<string, string>) { return this.offers.detail(id, q); }
}
