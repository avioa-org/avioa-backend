import { countBusinessDays } from 'src/modules/leaves/helpers/business-days.helper';

export interface Periodo {
  desde: Date;
  hasta: Date;
}

export interface RecorteResultado {
  fechaInicioEnPeriodo: Date;
  fechaFinEnPeriodo: Date;
  cantidadEnPeriodo: number;
  cantidadTotal: number;
  cruzaPeriodoAnterior: boolean;
  cruzaPeriodoSiguiente: boolean;
}

function diasCalendario(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function recortarAlPeriodo(
  inicioNovedad: Date,
  finNovedad: Date,
  periodo: Periodo,
  contarHabiles: boolean,
): RecorteResultado | null {
  if (inicioNovedad > periodo.hasta || finNovedad < periodo.desde) {
    return null; // no intersecta
  }

  const inicioRecortado =
    inicioNovedad > periodo.desde ? inicioNovedad : periodo.desde;
  const finRecortado = finNovedad < periodo.hasta ? finNovedad : periodo.hasta;

  const contar = contarHabiles ? countBusinessDays : diasCalendario;

  return {
    fechaInicioEnPeriodo: inicioRecortado,
    fechaFinEnPeriodo: finRecortado,
    cantidadEnPeriodo: contar(inicioRecortado, finRecortado),
    cantidadTotal: contar(inicioNovedad, finNovedad),
    cruzaPeriodoAnterior: inicioNovedad < periodo.desde,
    cruzaPeriodoSiguiente: finNovedad > periodo.hasta,
  };
}

// quincenas del mes
export function periodosDelMes(year: number, month: number): Periodo[] {
  const ultimoDia = new Date(year, month, 0).getDate();
  return [
    {
      desde: new Date(year, month - 1, 1),
      hasta: new Date(year, month - 1, 15),
    },
    {
      desde: new Date(year, month - 1, 16),
      hasta: new Date(year, month - 1, ultimoDia),
    },
  ];
}
