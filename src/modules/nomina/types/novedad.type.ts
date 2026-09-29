import { LeaveType } from 'generated/prisma/enums';

export type OrigenNovedad = 'LEAVE' | 'OVERTIME';
export type UnidadNovedad = 'DIAS' | 'HORAS';

export interface NovedadConsolidada {
  id: string; // leaveRequestId u overtimeRequestId
  origen: OrigenNovedad;
  tipo: LeaveType | 'HORAS_EXTRA';
  tipoLabel: string;
  unidad: UnidadNovedad;
  esRemunerada: boolean;
  afectaNomina: 'SUMA' | 'RESTA' | 'NEUTRO';

  // Colaborador
  userId: string;
  nombreColaborador: string;
  documentNumber: string | null;
  position: string | null;
  area: string | null;
  department: string | null;
  legalEntity: string | null;
  office: string | null;

  // Fechas reales (sin recortar)
  fechaInicio: string;
  fechaFin: string;

  // Recortado al periodo liquidado
  fechaInicioEnPeriodo: string;
  fechaFinEnPeriodo: string;
  cantidadEnPeriodo: number;
  cantidadTotal: number;

  cruzaPeriodoAnterior: boolean;
  cruzaPeriodoSiguiente: boolean;

  // Soporte y trazabilidad
  motivo: string;
  attachmentUrl: string | null;
  comentarioAprobador: string | null;
  aprobadorId: string;
  nombreAprobador: string;
  fechaRegistro: string;
  fechaAprobacion: string | null;

  horaInicio: string | null;
  horaFin: string | null;

  esParcial: boolean;
  totalHoras: number | null;
  esCompensada: boolean;

  createdAt: Date;
}

export interface ResumenColaborador {
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

export interface TotalesNomina {
  totalNovedades: number;
  colaboradoresAfectados: number;
  totalHorasExtra: number;
  totalDiasVacaciones: number;
  totalDiasAusencia: number;
  totalHorasParciales: number;
  totalDiasNoRemunerados: number;
  novedadesQueCruzanPeriodo: number;
  sinSoporte: number;
}
