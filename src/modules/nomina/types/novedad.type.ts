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

  // colaborador
  userId: string;
  nombreColaborador: string;
  documentNumber: string;
  position: string | null;
  area: string | null;
  department: string | null;
  legalEntity: string | null;
  office: string | null;

  // fechas
  fechaInicio: string;
  fechaFin: string;

  // recortado al periodo liquidado
  fechaInicioEnPeriodo: string;
  fechaFinEnPeriodo: string;
  cantidadEnPeriodo: number;
  cantidadTotal: number;

  cruzaPeriodoAnterioro: boolean;
  cruzaPeriodoSiguiente: boolean;

  // esto es para trazabilidad
  motivo: string;
  attachmentUr: string | null;
  comentarioAprobador: string | null;
  aprobadorId: string;
  nombreAprobador: string;
  fechaRegistro: string;
  fechaAprobacion: string | null;
}
