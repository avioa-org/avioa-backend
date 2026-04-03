import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EventoPTDto } from './dto/pago-total.dto';
import { envs } from 'src/config/env.config';
import { PagoTotalClasificadorService } from './pago-total-clasificador.service';

@Processor('pago-total')
export class PagoTotalProcessor extends WorkerHost {
  private readonly logger = new Logger(PagoTotalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clasificador: PagoTotalClasificadorService,
  ) {
    super();
  }

  async process(job: Job<EventoPTDto>): Promise<void> {
    const evento = job.data;

    this.logger.debug(evento);

    const registro = await this.prisma.hiloPagoTotal.findUnique({
      where: { threadId: evento.threadId },
    });

    const yaConfirmado = registro?.estado === 'CONFIRMADO';
    const tieneNuevos = evento.mensajesNuevos.length > 0;

    if (yaConfirmado && !tieneNuevos) return;
    if (!tieneNuevos && registro) return;

    const apiKey = envs.openaiApiKey;

    for (const msg of evento.mensajesNuevos) {
      if (!this.clasificador.mencionaPagoTotal(msg.cuerpo)) continue;

      const { intencion, confianza, razon } =
        await this.clasificador.clasificarIntencion(
          msg.cuerpo,
          msg.asunto,
          apiKey as string,
        );

      if (intencion === 'OTRO') {
        this.logger.log(`Falso positivo: "${msg.asunto}" - ${razon}`);
        continue;
      }

      if (confianza >= 0.75) {
        const estado =
          intencion === 'CONFIRMACION_PAGO' ? 'CONFIRMADO' : 'SOLICITUD';

        await this.prisma.hiloPagoTotal.upsert({
          where: { threadId: evento.threadId },
          create: {
            threadId: evento.threadId,
            asunto: evento.asunto,
            cliente: evento.cliente,
            estado,
            intencion,
            razon,
            ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
          },
          update: {
            estado,
            intencion,
            razon,
            ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
          },
        });

        return;
      }
    }

    // Sin condiciones - solo actualizar epoch
    await this.prisma.hiloPagoTotal.upsert({
      where: { threadId: evento.threadId },
      create: {
        threadId: evento.threadId,
        asunto: evento.asunto,
        cliente: evento.cliente,
        estado: 'DESCARTADO',
        ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
      },
      update: {
        ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
      },
    });
  }
}
