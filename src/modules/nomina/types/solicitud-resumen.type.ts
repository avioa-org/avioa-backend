export interface SolicitudResumen {
  id: string;
  origen: 'LEAVE' | 'OVERTIME';
  tipo: string; // LeaveType o 'HORAS_EXTRA'
  tipoLabel: string;
  unidad: 'DIAS' | 'HORAS';
  status: string;
  statusLabel: string;

  userId: string;
  nombreColaborador: string;
  documentNumber: string | null;
  position: string | null;
  area: string | null;
  department: string | null;
  legalEntity: string | null;

  fechaInicio: string;
  fechaFin: string;
  cantidad: number;

  horaInicio: string | null;
  horaFin: string | null;

  esCompensada: boolean;
  motivo: string;
  attachmentUrl: string | null;
  comentario: string | null;

  nombreAprobador: string | null;
  fechaRegistro: string;
  fechaDecision: string | null;
}

export interface SolicitudesPaginadas {
  data: SolicitudResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
