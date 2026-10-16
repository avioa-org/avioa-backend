import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import * as axios from 'axios';
import { envs } from 'src/config/env.config';

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
}
