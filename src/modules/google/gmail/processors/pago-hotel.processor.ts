import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { GmailService } from '../gmail.service';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';

interface AlertJobData {
  threadId: string;
  subject: string;
  level: number;
}

@Processor('hotel-payment-alerts')
export class PagoHotelInmediatoProcessor extends WorkerHost {
  private readonly logger = new Logger(PagoHotelInmediatoProcessor.name);
  constructor(
    private readonly gmailService: GmailService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<AlertJobData>): Promise<void> {
    const { threadId, subject, level } = job.data;

    const record = await this.prisma.hotelImmediatePayment.findUnique({
      where: { threadId },
    });

    if (!record || record.answered) {
      this.logger.warn(`${threadId} ya no requiere alerta, se descarta`);
      return;
    }

    if (record.notificationLevel >= level) {
      this.logger.warn(
        `Alerta nivel ${level} ya enviada antes para ${threadId}`,
      );
      return;
    }

    if (!this.evolutionApi.instanciaActiva) {
      throw new Error('Evolution API no disponible');
    }

    const text = this.buildMessage(subject, level);

    await this.evolutionApi.enviarMensaje(text);

    await this.prisma.hotelImmediatePayment.update({
      where: { threadId },
      data: { notificationLevel: level, lastNotifiedAt: new Date() },
    });

    this.logger.log(`Alerta nivel ${level} enviada para ${threadId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AlertJobData>, err: Error) {
    this.logger.error(
      `Job ${job.id} (hilo ${job.data.threadId}) falló, intento ${job.attemptsMade}: ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AlertJobData>) {
    this.logger.log(`Job ${job.id} (hilo ${job.data.threadId}) completado`);
  }

  private buildMessage(subject: string, level: number): string {
    const prefixes: Record<number, string> = {
      1: '🔔 Primer aviso [HOTEL REQUIERE PAGO INMEDIATO] ',
      2: '⚠️ Segundo aviso [HOTEL REQUIERE PAGO INMEDIATO] ',
      3: '🚨 Tercer aviso [HOTEL REQUIERE PAGO INMEDIATO] (urgente)',
    };
    return `${prefixes[level]}:correo sin responder\nAsunto: ${subject}`;
  }
}
