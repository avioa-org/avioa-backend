import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/env.config';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {}

  private get baseUrl() {
    return this.config.get<string>('EVOLUTION_URL');
  }
  private get instance() {
    return envs.EVOLUTION_INSTANCE;
  }
  private get apiKey() {
    return envs.EVOLUTION_API_KEY;
  }
  private get numero() {
    return envs.EVOLUTION_NUMERO_DESTINO;
  }
  private get correo() {
    return this.config.get<string>('CORREO_ALERTA');
  }

  async instanciaActiva(): Promise<boolean> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(
          `${this.baseUrl}/instance/connectionState/${this.instance}`,
          { headers: { apiKey: this.apiKey } },
        ),
      );
      return data?.instance?.state === 'open';
    } catch (error) {
      return false;
    }
  }

  public async enviarMensaje(texto: string): Promise<void> {
    const activa = await this.instanciaActiva();

    if (!activa) {
      this.logger.warn(
        'Evolution API no disponible — enviando alerta por email',
      );

      // Aqui se integraria la alerta con email
      this.logger.error(`ALERTA EMAIL: ${texto}`);
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/message/sendText/${this.instance}`,
          { number: this.numero, text: texto },
          { headers: { apiKey: this.apiKey } },
        ),
      );
      this.logger.log('Alerta WhatsApp enviada correctamente');
    } catch (e) {
      this.logger.error(`Error enviando WhatsApp: ${e?.['message']}`);
    }
  }
}
