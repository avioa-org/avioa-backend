import { HttpService } from '@nestjs/axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CotizadorDto } from './dto/cotizador.dto';
import { envs } from 'src/config/env.config';

@Processor('cotizador', {
  concurrency: 2,
})
export class CotizadorProcessor extends WorkerHost {
  private readonly logger = new Logger(CotizadorProcessor.name);

  constructor(private readonly httpService: HttpService) {
    super();
  }

  async process(job: Job<CotizadorDto>): Promise<any> {
    const dto = job.data;

    this.logger.log(`Procesando cotización ${job.id}`);

    try {
      await job.updateProgress({
        percentage: 5,
        message: 'Iniciando cotización...',
      });

      this.logger.log(`Cotización ${job.id}: enviando solicitud a FastAPI`);

      await job.updateProgress(10);

      const response = await this.httpService.axiosRef.post(
        envs.COTIZADOR_URL,
        {
          ...dto,
          job_id: job.id,
        },
        {
          timeout: 300000,
          headers: {
            'x-cotizador-job-id': String(job.id),
          },
        },
      );

      await job.updateProgress({
        percentage: 100,
        message: 'Cotización completada',
      });

      this.logger.log(`Cotización ${job.id}: FastAPI respondió`);

      this.logger.log(`Cotización ${job.id} completada`);

      return response.data;
    } catch (error) {
      this.logger.error(`Error procesando cotización ${job.id}`, error);
      throw error;
    }
  }
}
