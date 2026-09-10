import { CensatiasStatus } from 'generated/prisma/enums';

export const TRANSICIONES_VALIDAS: Record<CensatiasStatus, CensatiasStatus[]> =
  {
    RECIBIDA: ['EN_REVISION'],
    EN_REVISION: ['PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'],
    PENDIENTE_DOCUMENTOS: ['CORREGIDA', 'DESISTIDA'],
    CORREGIDA: ['EN_REVISION'],
    APROBADA: ['ENVIADA_AL_FONDO'],
    RECHAZADA: ['CERRADA'],
    ENVIADA_AL_FONDO: ['PAGADA_FINALIZADA', 'RECHAZADA'], // el fondo también puede rechazar
    PAGADA_FINALIZADA: ['CERRADA'],
    DESISTIDA: ['CERRADA'],
    CERRADA: [],
  };

export function puedeTransicionar(
  actual: CensatiasStatus,
  nuevo: CensatiasStatus,
): boolean {
  return TRANSICIONES_VALIDAS[actual]?.includes(nuevo) ?? false;
}
