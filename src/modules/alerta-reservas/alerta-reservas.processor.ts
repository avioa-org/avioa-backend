import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AlertaReservasService } from './alerta-reservas.service';
import { Job } from 'bullmq';
import { EventoPTDto } from 'src/common/dto/gmail-evento.dto';

@Processor('alerta-reservas')
export class AlertaReservasProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertaReservasProcessor.name);

  constructor(private readonly alertaReservasService: AlertaReservasService) {
    super();
  }

  async process(job: Job<EventoPTDto>): Promise<void> {
    const evento = job.data;
    await this.alertaReservasService.procesarReservas(evento);
  }
}
