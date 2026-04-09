import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { PagoTotalClasificadorService } from './pago-total-clasificador.service';
import { EventoPTDto } from '../../common/dto/gmail-evento.dto';
import { envs } from 'src/config/env.config';

@Injectable()
export class PagoTotalService {
  private readonly logger = new Logger(PagoTotalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clasificador: PagoTotalClasificadorService,
  ) {}

  public async procesarHiloPagoTotal(evento: EventoPTDto) {
    const registro = await this.prisma.hiloPagoTotal.findUnique({
      where: { threadId: evento.threadId },
    });

    const mensajesAAnalizar = !registro
      ? evento.todosLosMensajes
      : evento.mensajesNuevos;

    if (mensajesAAnalizar.length === 0) return;

    const apiKey = envs.OPENAI_API_KEY;

    for (const msg of mensajesAAnalizar) {
      if (!this.clasificador.mencionaPagoTotal(msg.cuerpo)) continue;

      const porRegex = this.clasificador.clasificarPorRegex(msg.cuerpo);
      if (porRegex !== null) {
        const { intencion, confianza, razon } = porRegex;

        const estado = intencion === 'OTRO' ? 'DESCARTADO' : 'CONFIRMADO';

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

        this.logger.log(
          `Hilo ${evento.asunto} clasificado como ${estado} con confianza ${confianza} (${razon})`,
        );
      }

      const { intencion, confianza, razon } =
        await this.clasificador.clasificarIntencion(
          msg.cuerpo,
          msg.asunto,
          apiKey,
        );

      this.logger.debug(
        `Intención: ${intencion}, Confianza: ${confianza}, Razón: ${razon}`,
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

        this.logger.log(
          `Hilo ${evento.asunto} clasificado como ${estado} con confianza ${confianza} (${razon})`,
        );

        return;
      } else if (confianza >= 0.5) {
        // Guardar el correo para revision manual
        await this.prisma.hiloPagoTotal.upsert({
          where: { threadId: evento.threadId },
          create: {
            threadId: evento.threadId,
            asunto: evento.asunto,
            cliente: evento.cliente,
            estado: 'REVISION',
            intencion,
            razon,
            ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
          },
          update: {
            estado: 'REVISION',
            intencion,
            razon,
            ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
          },
        });

        this.logger.log(
          `Hilo ${evento.asunto} marcado para revisión manual con confianza ${confianza} (${razon})`,
        );

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

  public async obtenerParaSheet() {
    const hilos = await this.prisma.hiloPagoTotal.findMany({
      where: {
        estado: { in: ['CONFIRMADO', 'REVISION'] },
        syncSheet: false,
      },
      select: {
        asunto: true,
        cliente: true,
        threadId: true,
        estado: true,
        creadoEn: true,
      },
    });
    // Marcar como sincronizados
    if (hilos.length > 0) {
      await this.prisma.hiloPagoTotal.updateMany({
        where: { threadId: { in: hilos.map((n) => n.threadId) } },
        data: { syncSheet: true },
      });
    }

    return {
      procesados: hilos.map((h) => ({
        asunto: h.asunto,
        fecha: h.creadoEn.toLocaleString('es-ES'),
        from: h.cliente,
        threadId: h.threadId,
        estado: h.estado,
      })),
    };
  }
}
