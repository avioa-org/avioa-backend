import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { PagoTotalClasificadorService } from './pago-total-clasificador.service';
import { EventoPTDto } from './dto/pago-total.dto';
import { envs } from 'src/config/env.config';

@Injectable()
export class PagoTotalService {
  private readonly logger = new Logger(PagoTotalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clasificador: PagoTotalClasificadorService,
  ) {}

  public async procesarHiloPagoTotal(evento: EventoPTDto) {
    // if (evento.mensajesNuevos.length === 0) return;

    this.logger.debug(`Procesando hilo ${evento.threadId}`);

    // this.logger.debug(evento);

    const registro = await this.prisma.hiloPagoTotal.findUnique({
      where: { threadId: evento.threadId },
    });

    // const yaConfirmado = registro?.estado === 'CONFIRMADO';
    // const tieneNuevos = evento.mensajesNuevos.length > 0;

    // if (yaConfirmado && !tieneNuevos) return;
    // if (!tieneNuevos && registro) return;

    const mensajesAAnalizar = !registro
      ? evento.todosLosMensajes
      : evento.mensajesNuevos;

    if (mensajesAAnalizar.length === 0) return;

    const apiKey = envs.openaiApiKey;

    for (const msg of mensajesAAnalizar) {
      if (!this.clasificador.mencionaPagoTotal(msg.cuerpo)) continue;

      //   const esConfirmacionDirecta = [
      //     /ingreso\s+pago\s+total/i,
      //     /ingreso[\s:]+\$?[\d\.,]+\s+pago\s+total/i,
      //     /pago\s+total\s+realizado/i,
      //     /confirmo\s+(el\s+)?pago\s+total/i,
      //     /pago\s+total/,
      //   ].some((r) => r.test(msg.cuerpo));

      //   if (esConfirmacionDirecta) {
      //     await this.prisma.hiloPagoTotal.upsert({
      //       where: { threadId: evento.threadId },
      //       create: {
      //         threadId: evento.threadId,
      //         asunto: evento.asunto,
      //         cliente: evento.cliente,
      //         estado: 'CONFIRMADO',
      //         intencion: 'CONFIRMACION_PAGO',
      //         razon: 'patrón directo detectado',
      //         ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
      //       },
      //       update: {
      //         estado: 'CONFIRMADO',
      //         intencion: 'CONFIRMACION_PAGO',
      //         razon: 'patrón directo detectado',
      //         ultimoMensaje: BigInt(evento.ultimoMensajeEpochMs),
      //       },
      //     });

      //     return {
      //       intencion: 'CONFIRMACION_PAGO',
      //       confianza: 1.0,
      //       razon: 'patrón directo detectado',
      //     };
      //   }

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
      }

      const { intencion, confianza, razon } =
        await this.clasificador.clasificarIntencion(
          msg.cuerpo,
          msg.asunto,
          apiKey as string,
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
          `Hilo ${evento.threadId} clasificado como ${estado} con confianza ${confianza} (${razon})`,
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
          `Hilo ${evento.threadId} marcado para revisión manual con confianza ${confianza} (${razon})`,
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
        fecha: h.creadoEn.toISOString(),
        from: h.cliente,
        threadId: h.threadId,
        estado: h.estado,
      })),
    };
  }
}
