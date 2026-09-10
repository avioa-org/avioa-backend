import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import { CreateCesantiasDto } from './dto/crear-cesantias.dto';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { CATALOGO_MOTIVO } from './cesantias.constant';
import {
  correoCambioEstado,
  correoConfirmacionColaborador,
  correoNotificacionGH,
} from './cesantias-emails';
import { puedeTransicionar } from './cesantias-state-machine';

@Injectable()
export class CesantiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async generarRadicado(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.cesantiasRequest.count({
      where: { radicado: { startsWith: `CES-${year}-` } },
    });
    const next = String(count + 1).padStart(4, '0');
    return `CES-${year}-${next}`;
  }

  async create(userId: string, dto: CreateCesantiasDto) {
    const detalleMotivo =
      dto.detalleEducacion ??
      dto.detalleVivienda ??
      dto.detallePredial ??
      dto.detalleTerminacion;

    if (!detalleMotivo) {
      throw new BadRequestException(
        'Debes aceptar todas las declaraciones para continuar.',
      );
    }

    const radicado = await this.generarRadicado();

    const request = await this.prisma.cesantiasRequest.create({
      data: {
        radicado,
        userId,
        status: 'RECIBIDA',
        nombreCompleto: dto.nombreCompleto,
        tipoDocumento: dto.tipoDocumento,
        numeroDocumento: dto.numeroDocumento,
        correo: dto.correo,
        telefono: dto.telefono,
        cargo: dto.cargo,
        area: dto.area,
        razonSocial: dto.razonSocial,
        fondo: dto.fondo,
        fondoOtro: dto.fondoOtro,
        valorSolicitado: dto.valorSolicitado,
        saldoDisponible: dto.saldoDisponible,
        motivo: dto.motivo,
        detalleMotivo: JSON.stringify(detalleMotivo),
        declaraVeracidad: dto.declaraVeracidad,
        declaraDestinacion: dto.declaraDestinacion,
        declaraTratamientoDatos: dto.declaraTratamientoDatos,
        declaraDocsAdicionales: dto.declaraDocsAdicionales,
      },
    });

    const motivoLabel = CATALOGO_MOTIVO.find(
      (m) => m.value === dto.motivo,
    )?.label;

    const confirmacion = correoConfirmacionColaborador(
      dto.nombreCompleto,
      radicado,
    );
    await this.emailService.send(
      dto.correo,
      confirmacion.subject,
      confirmacion.html,
    );

    const notifRRHH = correoNotificacionGH(
      radicado,
      dto.nombreCompleto,
      motivoLabel as string,
    );
    await this.emailService.send(
      process.env.RRHH_NOTIFICATIONS_EMAIL!,
      notifRRHH.subject,
      notifRRHH.html,
    );

    return request;
  }

  async cambiarEstado(
    cesantiasRequestId: string,
    actorId: string,
    nuevoEstado: string,
    payload: any,
  ) {
    const request = await this.prisma.cesantiasRequest.findUniqueOrThrow({
      where: { cesantiasRequestId },
    });

    if (!puedeTransicionar(request.status, nuevoEstado as any)) {
      throw new BadRequestException(
        `No se puede pasar de "${request.status}" a "${nuevoEstado}".`,
      );
    }

    if (nuevoEstado === 'PENDIENTE_DOCUMENTOS' && !payload.comentario) {
      throw new BadRequestException('El motivo de devolución es obligatorio.');
    }

    if (nuevoEstado === 'RECHAZADA' && !payload.comentario) {
      throw new BadRequestException('El motivo de rechazo es obligatorio.');
    }

    const updated = await this.prisma.cesantiasRequest.update({
      where: { cesantiasRequestId },
      data: {
        status: nuevoEstado as any,
        responsableId: actorId,
        fechaDecision: ['APROBADA', 'RECHAZADA'].includes(nuevoEstado)
          ? new Date()
          : undefined,
        motivoDevolucion:
          nuevoEstado === 'PENDIENTE_DOCUMENTOS'
            ? payload.comentario
            : undefined,
        numeroTramiteFondo:
          nuevoEstado === 'ENVIADA_AL_FONDO'
            ? payload.numeroTramiteFondo
            : undefined,
        fechaEnvioFondo:
          nuevoEstado === 'ENVIADA_AL_FONDO' ? new Date() : undefined,
        fechaCierra:
          nuevoEstado === 'CERRADA' ? new Date().toString() : undefined,
        observaciones: payload.comentario,
      },
    });

    await this.prisma.cesantiasHistorial.create({
      data: {
        requestId: cesantiasRequestId,
        actorId,
        accion: nuevoEstado,
        comentario: payload.comentario,
      },
    });

    const correo = correoCambioEstado(
      request.nombreCompleto,
      request.radicado,
      nuevoEstado,
      payload.comentario,
    );
    await this.emailService.send(request.correo, correo.subject, correo.html);

    return updated;
  }
}
