import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { Periodo, recortarAlPeriodo } from './utils/periodo.util';
import { type NovedadConsolidada } from './types/novedad.type';
import { LeavesController } from '../leaves/leaves.controller';
import { LeaveStatus, LeaveType, OvertimeStatus } from 'generated/prisma/enums';
import { CONFIG_TIPOS, resolverConfigVacaciones } from './config/tipos-novedad';

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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
        ...(filtros.userId && { userId: filtros.userId }),
        ...(filtros.leaderId && { leaderId: filtros.leaderId }),
        ...(tiposLeave?.length && { type: { in: tiposLeave } }),
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

          motivo: leave.reason,
          attachmentUrl: leave.attachmentUrl,
          comentarioAprobador: leave.comment,
          aprobadorId: leave.leaderId,
          nombreAprobador: leave.leader.name,
          fechaRegistro: this.formatDateLocal(leave.createdAt),
          fechaAprobacion:
            (leave.reviewedAt && this.formatDateLocal(leave.reviewedAt)) ??
            null,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);
  }

  private async obtenerOvertimes(
    periodo: Periodo,
    filtros: FiltrosNomina,
  ): Promise<NovedadConsolidada[]> {
    if (filtros.tipos?.length && !filtros.tipos.includes('HORAS_EXTRA'))
      return [];

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

      motivo: ot.description,
      attachmentUrl: null,
      comentarioAprobador: ot.comment,
      aprobadorId: ot.leaderId,
      nombreAprobador: ot.leader.name,
      fechaRegistro: this.formatDateLocal(ot.createdAt),
      fechaAprobacion:
        (ot.reviewedAt && this.formatDateLocal(ot.reviewedAt)) ?? null,
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
}
