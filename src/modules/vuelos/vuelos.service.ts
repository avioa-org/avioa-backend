import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import * as axios from 'axios';
import { envs } from 'src/config/env.config';
import { FiltroVuelosDto } from './dto/filtros-vuelos.dto';

@Injectable()
export class VuelosService {
  private readonly logger = new Logger(VuelosService.name);

  constructor(private readonly httpService: HttpService) {}

  public async getMejoresDelDia() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${envs.SERPAPI_VUELOS_URL}/mejores-del-dia`),
      );

      this.logger.log(`SerpApi respondio con HTTP ${response.status}`);

      return { data: response.data };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Error consultando SerpApi: ${error.message}; ` +
            `HTTP: ${error.response?.status ?? 'sin respuesta'}`,
          error.stack,
        );
      } else if (error instanceof Error) {
        this.logger.error(
          `Error consultando vuelos: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Error desconocido consultando vuelos');
      }

      throw new InternalServerErrorException(
        'No fue posible consultar los mejores vuelos del día',
      );
    }
  }

  public async getOfertas(filtros: FiltroVuelosDto) {
    try {
      const params: Record<string, string | number | boolean> = {};

      if (filtros.origen) params.origen = filtros.origen.toUpperCase();
      if (filtros.destino) params.destino = filtros.destino.toUpperCase();
      if (filtros.aerolinea) params.aerolinea = filtros.aerolinea;
      if (filtros.solo_gangas !== undefined)
        params.solo_gangas = filtros.solo_gangas;
      if (filtros.limit) params.limit = filtros.limit;
      if (filtros.horas !== undefined) params.horas = filtros.horas;
      if (filtros.precio_max !== undefined)
        params.precio_max = filtros.precio_max;
      if (filtros.precio_min !== undefined)
        params.precio_min = filtros.precio_min;
      if (filtros.max_escalas !== undefined)
        params.max_escalas = filtros.max_escalas;
      if (filtros.fecha_ida_desde)
        params.fecha_ida_desde = filtros.fecha_ida_desde;
      if (filtros.fecha_ida_hasta)
        params.fecha_ida_hasta = filtros.fecha_ida_hasta;

      const { data } = await firstValueFrom(
        this.httpService.get(`${envs.SERPAPI_VUELOS_URL}/ofertas`, { params }),
      );

      return { data };
    } catch (error: any) {
      this.logger.error(
        `Error al consultar vuelos: ${error?.message || error}`,
        error?.stack,
      );

      throw new InternalServerErrorException(
        'No se pudieron obtener las ofertas de vuelos',
      );
    }
  }
}
