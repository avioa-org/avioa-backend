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
}
