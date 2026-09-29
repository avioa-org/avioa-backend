import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { Periodo, recortarAlPeriodo } from './utils/periodo.util';
import { type NovedadConsolidada } from './types/novedad.type';
import { LeavesController } from '../leaves/leaves.controller';
import { LeaveStatus, LeaveType, OvertimeStatus } from 'generated/prisma/enums';
import { CONFIG_TIPOS, resolverConfigVacaciones } from './config/tipos-novedad';
import { HISTORICAL_MIGRATION_TAG } from '../leaves/leaves.service';
import { FiltrosSolicitudesDto } from './dto/fiiltro-solicitudes.dto';
import {
  SolicitudesPaginadas,
  SolicitudResumen,
} from './types/solicitud-resumen.type';
import { Prisma } from 'generated/prisma/browser';

export interface FiltrosNomina {
  desde: string; // YYYY-MM-DD
  hasta: string;
  userId?: string;
  tipos?: string[]; // LeaveType[] + 'HORAS_EXTRA'
  area?: string;
  department?: string;
  legalEntity?: string;
  office?: string;
  leaderId?: string;
  soloRemuneradas?: boolean;
  esCompensada?: boolean;
}

const USER_SELECT = {
  userId: true,
  name: true,
  documentNumber: true,
  position: true,
  area: true,
  department: true,
  legalEntity: true,
  office: true,
} as const;

const ESTADOS_LEAVE_VALIDOS: LeaveStatus[] = [
  'PENDING_HR_VALIDATION',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as LeaveStatus[];

const ESTADOS_OVERTIME_VALIDOS: OvertimeStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING_HR_VALIDATION: 'Pendiente validación GH',
  PENDING: 'Pendiente de líder',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const OVERTIME_STATUS_LABELS: Record<OvertimeStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

@Injectable()
export class NominaService {
  private readonly logger = new Logger(NominaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parsePeriodo(desde: string, hasta: string): Periodo {
    const [ys, ms, ds] = desde.split('-').map(Number);
    const [ye, me, de] = hasta.split('-').map(Number);
    const inicio = new Date(ys, ms - 1, ds);
    const fin = new Date(ye, me - 1, de);
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);
    return { desde: inicio, hasta: fin };
  }

  private formatDateLocal(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private calcularHoras(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const minutos = eh * 60 + em - (sh * 60 + sm);
    return Math.round((minutos / 60) * 100) / 100;
  }

  async consolidar(filtros: FiltrosNomina): Promise<NovedadConsolidada[]> {
    const periodo = this.parsePeriodo(filtros.desde, filtros.hasta);

    const [leaves, overtimes] = await Promise.all([
      this.obtenerLeaves(periodo, filtros),
      this.obtenerOvertimes(periodo, filtros),
    ]);

    let novedades = [...leaves, ...overtimes];

    if (filtros.soloRemuneradas) {
      novedades = novedades.filter((n) => n.esRemunerada);
    }

    return novedades.sort((a, b) => {
      const porNombre = a.nombreColaborador.localeCompare(b.nombreColaborador);
      if (porNombre !== 0) return porNombre;
      return a.fechaInicioEnPeriodo.localeCompare(b.fechaInicioEnPeriodo);
    });
  }

  async findAllSolicitudes(
    filtros: FiltrosSolicitudesDto,
  ): Promise<SolicitudesPaginadas> {
    const page = filtros.page ?? 1;
    const pageSize = filtros.pageSize ?? 20;

    const tiposLeave = filtros.tipos?.filter(
      (t) => t !== 'HORAS_EXTRA',
    ) as LeaveType[];

    console.log('[findAllSolicitudes] filtros.tipos =', filtros.tipos);

    const incluirLeaves = !filtros.tipos?.length || tiposLeave.length > 0;

    const incluirOvertime =
      !filtros.tipos?.length || filtros.tipos.includes('HORAS_EXTRA');

    console.log('[findAllSolicitudes]', {
      tiposLeave,
      incluirLeaves,
      incluirOvertime,
    });

    const estadosLeave = filtros.estados?.filter((e) =>
      ESTADOS_LEAVE_VALIDOS.includes(e as LeaveStatus),
    ) as LeaveStatus[] | undefined;

    const estadosOvertime = filtros.estados?.filter((e) =>
      ESTADOS_OVERTIME_VALIDOS.includes(e as OvertimeStatus),
    ) as OvertimeStatus[] | undefined;

    const debeConsultarLeaves =
      incluirLeaves && (!filtros.estados?.length || !!estadosLeave?.length);
    const debeConsultarOvertime =
      incluirOvertime &&
      (!filtros.estados?.length || !!estadosOvertime?.length);

    const rangoFechas = this.buildRangoFechas(filtros.desde, filtros.hasta);
    const filtroUsuario: Prisma.UserWhereInput = {
      ...(filtros.area && { area: filtros.area }),
      ...(filtros.department && { department: filtros.department }),
      ...(filtros.legalEntity && { legalEntity: filtros.legalEntity }),
      isUserTest: false,
    };

    const [leaves, overtimes] = await Promise.all([
      debeConsultarLeaves
        ? this.queryLeaves(
            filtros,
            tiposLeave,
            estadosLeave,
            rangoFechas,
            filtroUsuario,
          )
        : [],
      debeConsultarOvertime
        ? this.queryOvertimes(
            filtros,
            estadosOvertime,
            rangoFechas,
            filtroUsuario,
          )
        : [],
    ]);

    const todas = [...leaves, ...overtimes].sort(
      (a, b) =>
        new Date(b.fechaRegistro).getTime() -
        new Date(a.fechaRegistro).getTime(),
    );

    const total = todas.length;
    const start = (page - 1) * pageSize;
    const data = todas.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  private async obtenerLeaves(
    periodo: Periodo,
    filtros: FiltrosNomina,
  ): Promise<NovedadConsolidada[]> {
    const tiposLeave = filtros.tipos?.filter((t) => t !== 'HORAS_EXTRA') as
      | LeaveType[]
      | undefined;

    if (filtros.tipos?.length && !tiposLeave?.length) return [];

    const registros = await this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,

        startDate: { lte: periodo.hasta },
        endDate: { gte: periodo.desde },
        NOT: {
          reason: { contains: HISTORICAL_MIGRATION_TAG },
        },
        ...(filtros.userId && { userId: filtros.userId }),
        ...(filtros.leaderId && { leaderId: filtros.leaderId }),
        ...(tiposLeave?.length && { type: { in: tiposLeave } }),
        ...(filtros.esCompensada !== undefined && {
          esCompensada: filtros.esCompensada,
        }),
        user: {
          ...(filtros.area && { area: filtros.area }),
          ...(filtros.department && { department: filtros.department }),
          ...(filtros.legalEntity && { legalEntity: filtros.legalEntity }),
          ...(filtros.office && { office: filtros.office }),
          AND: { NOT: { isUserTest: true } },
        },
      },
      include: {
        user: { select: USER_SELECT },
        leader: { select: { name: true } },
      },
    });

    return registros
      .map((leave) => {
        const config =
          leave.type === LeaveType.VACACIONES
            ? resolverConfigVacaciones(leave.esCompensada)
            : CONFIG_TIPOS[leave.type];

        const recorte = recortarAlPeriodo(
          leave.startDate,
          leave.endDate,
          periodo,
          config.contarHabiles,
        );

        if (!recorte || recorte.cantidadEnPeriodo === 0) return null;

        const hasHours = !!leave.startTime && !!leave.endTime;
        const totalHoras = hasHours
          ? this.calcularHoras(leave.startTime!, leave.endTime!)
          : null;

        return {
          id: leave.leaveRequestId,
          origen: 'LEAVE' as const,
          tipo: leave.type,
          tipoLabel: config.label,
          unidad: 'DIAS' as const,
          esRemunerada: config.esRemunerada,
          afectaNomina: config.afectaNomina,
          esCompensada: leave.esCompensada,

          userId: leave.user.userId,
          nombreColaborador: leave.user.name,
          documentNumber: leave.user.documentNumber,
          position: leave.user.position,
          area: leave.user.area,
          department: leave.user.department,
          legalEntity: leave.user.legalEntity,
          office: leave.user.office,

          fechaInicio: this.formatDateLocal(leave.startDate),
          fechaFin: this.formatDateLocal(leave.endDate),

          fechaInicioEnPeriodo: this.formatDateLocal(
            recorte.fechaInicioEnPeriodo,
          ),

          fechaFinEnPeriodo: this.formatDateLocal(recorte.fechaFinEnPeriodo),

          cantidadEnPeriodo: recorte.cantidadEnPeriodo,
          cantidadTotal: recorte.cantidadTotal,
          cruzaPeriodoAnterior: recorte.cruzaPeriodoAnterior,
          cruzaPeriodoSiguiente: recorte.cruzaPeriodoSiguiente,

          horaInicio: hasHours ? leave.startTime! : null,
          horaFin: hasHours ? leave.endTime! : null,
          esParcial: hasHours,
          totalHoras,

          motivo: leave.reason,
          attachmentUrl: leave.attachmentUrl,
          comentarioAprobador: leave.comment,
          aprobadorId: leave.leaderId,
          nombreAprobador: leave.leader.name,
          fechaRegistro: this.formatDateLocal(leave.createdAt),
          fechaAprobacion:
            (leave.reviewedAt && this.formatDateLocal(leave.reviewedAt)) ??
            null,
          createdAt: leave.createdAt,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);
  }

  private formatearHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    });
  }

  private async obtenerOvertimes(
    periodo: Periodo,
    filtros: FiltrosNomina,
  ): Promise<NovedadConsolidada[]> {
    if (filtros.tipos?.length && !filtros.tipos.includes('HORAS_EXTRA'))
      return [];

    if (filtros.esCompensada === true) return [];

    const registros = await this.prisma.overtimeRequest.findMany({
      where: {
        status: OvertimeStatus.APPROVED,
        date: { gte: periodo.desde, lte: periodo.hasta },
        ...(filtros.userId && { userId: filtros.userId }),
        ...(filtros.leaderId && { leaderId: filtros.leaderId }),
        user: {
          ...(filtros.area && { area: filtros.area }),
          ...(filtros.department && { department: filtros.department }),
          ...(filtros.legalEntity && { legalEntity: filtros.legalEntity }),
          ...(filtros.office && { office: filtros.office }),
        },
      },
      include: {
        user: { select: USER_SELECT },
        leader: { select: { name: true } },
      },
    });

    return registros.map((ot) => ({
      id: ot.overtimeRequestId,
      origen: 'OVERTIME' as const,
      tipo: 'HORAS_EXTRA' as const,
      tipoLabel: 'Horas extra',
      unidad: 'HORAS' as const,
      esRemunerada: true,
      afectaNomina: 'SUMA' as const,

      userId: ot.user.userId,
      nombreColaborador: ot.user.name,
      documentNumber: ot.user.documentNumber,
      position: ot.user.position,
      area: ot.user.area,
      department: ot.user.department,
      legalEntity: ot.user.legalEntity,
      office: ot.user.office,

      fechaInicio: this.formatDateLocal(ot.date),
      fechaFin: this.formatDateLocal(ot.date),
      fechaInicioEnPeriodo: this.formatDateLocal(ot.date),
      fechaFinEnPeriodo: this.formatDateLocal(ot.date),
      cantidadEnPeriodo: ot.totalHours,
      cantidadTotal: ot.totalHours,
      cruzaPeriodoAnterior: false,
      cruzaPeriodoSiguiente: false,

      horaInicio: this.formatearHora(ot.startTime),
      horaFin: this.formatearHora(ot.endTime),

      esCompensada: false,
      esParcial: false,
      totalHoras: null,

      motivo: ot.description,
      attachmentUrl: null,
      comentarioAprobador: ot.comment,
      aprobadorId: ot.leaderId,
      nombreAprobador: ot.leader.name,
      fechaRegistro: this.formatDateLocal(ot.createdAt),
      fechaAprobacion:
        (ot.reviewedAt && this.formatDateLocal(ot.reviewedAt)) ?? null,
      createdAt: ot.createdAt,
    }));
  }

  async resumenPorColaborador(filtros: FiltrosNomina) {
    const novedades = await this.consolidar(filtros);

    const porUsuario = new Map<
      string,
      {
        userId: string;
        nombreColaborador: string;
        documentNumber: string | null;
        position: string | null;
        area: string | null;
        legalEntity: string | null;
        totalDiasAusencia: number;
        totalDiasVacaciones: number;
        totalHorasExtra: number;
        diasNoRemunerados: number;
        novedades: NovedadConsolidada[];
      }
    >();

    for (const n of novedades) {
      if (!porUsuario.has(n.userId)) {
        porUsuario.set(n.userId, {
          userId: n.userId,
          nombreColaborador: n.nombreColaborador,
          documentNumber: n.documentNumber,
          position: n.position,
          area: n.area,
          legalEntity: n.legalEntity,
          totalDiasAusencia: 0,
          totalDiasVacaciones: 0,
          totalHorasExtra: 0,
          diasNoRemunerados: 0,
          novedades: [],
        });
      }

      const acc = porUsuario.get(n.userId)!;
      acc.novedades.push(n);

      if (n.unidad === 'HORAS') {
        acc.totalHorasExtra += n.cantidadEnPeriodo;
      } else if (n.tipo === LeaveType.VACACIONES) {
        acc.totalDiasVacaciones += n.cantidadEnPeriodo;
      } else {
        acc.totalDiasAusencia += n.cantidadEnPeriodo;
      }

      if (!n.esRemunerada) {
        acc.diasNoRemunerados += n.cantidadEnPeriodo;
      }
    }

    return Array.from(porUsuario.values());
  }

  async totalesPeriodo(filtros: FiltrosNomina) {
    const novedades = await this.consolidar(filtros);

    return {
      totalNovedades: novedades.length,
      colaboradoresAfectados: new Set(novedades.map((n) => n.userId)).size,
      totalHorasExtra: novedades
        .filter((n) => n.unidad === 'HORAS')
        .reduce((s, n) => s + n.cantidadEnPeriodo, 0),
      totalDiasVacaciones: novedades
        .filter((n) => n.tipo === LeaveType.VACACIONES)
        .reduce((s, n) => s + n.cantidadEnPeriodo, 0),
      totalDiasAusencia: novedades
        .filter((n) => n.unidad === 'DIAS' && n.tipo !== LeaveType.VACACIONES)
        .reduce((s, n) => s + n.cantidadEnPeriodo, 0),
      totalDiasNoRemunerados: novedades
        .filter((n) => !n.esRemunerada)
        .reduce((s, n) => s + n.cantidadEnPeriodo, 0),
      totalHorasParciales: novedades
        .filter((n) => n.esParcial && n.totalHoras)
        .reduce((s, n) => s + (n.totalHoras ?? 0), 0),
      novedadesQueCruzanPeriodo: novedades.filter(
        (n) => n.cruzaPeriodoAnterior || n.cruzaPeriodoSiguiente,
      ).length,
      // sinSoporte: novedades.filter(
      //   (n) =>
      //     n.origen === 'LEAVE' &&
      //     !n.attachmentUrl &&
      //     [LeaveType.INCAPACIDAD_EPS, LeaveType.INCAPACIDAD_ARL].includes(
      //       n.tipo as LeaveType,
      //     ),
      // ).length,
      sinSoporte: novedades.filter(
        (n) =>
          n.origen === 'LEAVE' &&
          !n.attachmentUrl &&
          this.esIncapacidad(n.tipo),
      ).length,
    };
  }

  private esIncapacidad(tipo: LeaveType | 'HORAS_EXTRA'): boolean {
    return (
      tipo === LeaveType.INCAPACIDAD_EPS || tipo === LeaveType.INCAPACIDAD_ARL
    );
  }

  private buildRangoFechas(desde?: string, hasta?: string) {
    if (!desde && !hasta) return null;
    return {
      gte: desde ? new Date(`${desde}T00:00:00`) : undefined,
      lte: hasta ? new Date(`${hasta}T23:59:59.999`) : undefined,
    };
  }

  private async queryLeaves(
    filtros: FiltrosSolicitudesDto,
    tipos: LeaveType[] | undefined,
    estados: LeaveStatus[] | undefined,
    rangoFechas: { gte?: Date; lte?: Date } | null,
    filtroUsuario: Prisma.UserWhereInput,
  ): Promise<SolicitudResumen[]> {
    const registros = await this.prisma.leaveRequest.findMany({
      where: {
        ...(filtros.userId && { userId: filtros.userId }),
        ...(tipos?.length && { type: { in: tipos } }),
        ...(estados?.length && { status: { in: estados } }),
        ...(rangoFechas && { startDate: rangoFechas }),
        NOT: { reason: { contains: 'MIGRACION_HISTORICA_VACACIONES_2026' } },
        user: Object.keys(filtroUsuario).length ? filtroUsuario : undefined,
      },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            documentNumber: true,
            position: true,
            area: true,
            department: true,
            legalEntity: true,
          },
        },
        leader: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return registros.map((leave) => {
      const config =
        leave.type === LeaveType.VACACIONES
          ? resolverConfigVacaciones(leave.esCompensada)
          : CONFIG_TIPOS[leave.type];

      return {
        id: leave.leaveRequestId,
        origen: 'LEAVE',
        tipo: leave.type,
        tipoLabel: config.label,
        unidad: 'DIAS',
        status: leave.status,
        statusLabel: LEAVE_STATUS_LABELS[leave.status],

        userId: leave.user.userId,
        nombreColaborador: leave.user.name,
        documentNumber: leave.user.documentNumber,
        position: leave.user.position,
        area: leave.user.area,
        department: leave.user.department,
        legalEntity: leave.user.legalEntity,

        fechaInicio: leave.startDate.toISOString(),
        fechaFin: leave.endDate.toISOString(),
        cantidad: leave.businessDays,

        horaInicio: leave.startTime ?? null,
        horaFin: leave.endTime ?? null,

        esCompensada: leave.esCompensada,
        motivo: leave.reason,
        attachmentUrl: leave.attachmentUrl,
        comentario: leave.comment ?? leave.hrComment,

        nombreAprobador: leave.leader?.name ?? null,
        fechaRegistro: leave.createdAt.toISOString(),
        fechaDecision: leave.reviewedAt?.toISOString() ?? null,
      };
    });
  }

  private async queryOvertimes(
    filtros: FiltrosSolicitudesDto,
    estados: OvertimeStatus[] | undefined,
    rangoFechas: { gte?: Date; lte?: Date } | null,
    filtroUsuario: Prisma.UserWhereInput,
  ): Promise<SolicitudResumen[]> {
    const registros = await this.prisma.overtimeRequest.findMany({
      where: {
        ...(filtros.userId && { userId: filtros.userId }),
        ...(estados?.length && { status: { in: estados } }),
        ...(rangoFechas && { date: rangoFechas }),
        user: Object.keys(filtroUsuario).length ? filtroUsuario : undefined,
      },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            documentNumber: true,
            position: true,
            area: true,
            department: true,
            legalEntity: true,
          },
        },
        leader: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return registros.map((ot) => ({
      id: ot.overtimeRequestId,
      origen: 'OVERTIME',
      tipo: 'HORAS_EXTRA',
      tipoLabel: 'Horas extra',
      unidad: 'HORAS',
      status: ot.status,
      statusLabel: OVERTIME_STATUS_LABELS[ot.status],

      userId: ot.user.userId,
      nombreColaborador: ot.user.name,
      documentNumber: ot.user.documentNumber,
      position: ot.user.position,
      area: ot.user.area,
      department: ot.user.department,
      legalEntity: ot.user.legalEntity,

      fechaInicio: ot.date.toISOString(),
      fechaFin: ot.date.toISOString(),
      cantidad: ot.totalHours,

      horaInicio: this.formatearHora(ot.startTime),
      horaFin: this.formatearHora(ot.endTime),

      esCompensada: false,
      motivo: ot.description,
      attachmentUrl: null,
      comentario: ot.comment,

      nombreAprobador: ot.leader?.name ?? null,
      fechaRegistro: ot.createdAt.toISOString(),
      fechaDecision: ot.reviewedAt?.toISOString() ?? null,
    }));
  }
}
