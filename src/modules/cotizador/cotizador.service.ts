import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CotizadorDto } from './dto/cotizador.dto';
import { HttpService } from '@nestjs/axios';
import { envs } from 'src/config/env.config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CotizadorService {
  private readonly logger = new Logger(CotizadorService.name);
  constructor(
    private readonly httpService: HttpService,
    @InjectQueue('cotizador') private readonly cotizadorQueue: Queue,
  ) {}
  async cotizar(cotizadorDto: CotizadorDto) {
    const job = await this.cotizadorQueue.add('cotizador', cotizadorDto, {
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
      },
    });

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async estado(jobId: string) {
    const job = await this.cotizadorQueue.getJob(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
      };
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      status: state,
      progress: job.progress,
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
    };
  }

  async progress(
    jobId: string,
    percentage: number,
    message: string,
    secret?: string,
  ) {
    const job = await this.cotizadorQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`No existe el Job ${jobId}`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }

    await job.updateProgress({
      percentage,
      message,
    });

    this.logger.log(`Job ${jobId}: ${percentage}% - ${message}`);

    return {
      jobId,
      percentage,
      message,
    };
  }
}
