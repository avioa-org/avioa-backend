import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventoPTDto } from '../../common/dto/gmail-evento.dto';
import { PagoTotalService } from './pago-total.service';

@Processor('pago-total')
export class PagoTotalProcessor extends WorkerHost {
  private readonly logger = new Logger(PagoTotalProcessor.name);

  constructor(private readonly pagoTotalService: PagoTotalService) {
    super();
  }

  async process(job: Job<EventoPTDto>): Promise<void> {
    const evento = job.data;
    await this.pagoTotalService.procesarHiloPagoTotal(evento);
  }
}
