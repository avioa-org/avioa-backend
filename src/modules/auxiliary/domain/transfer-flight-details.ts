// src/auxiliary/domain/transfer-flight-details.ts
import type { TransferVoucher } from './aux-transfer';

export const transferLongDate = (value: string) => {
  if (!value) return 'Por confirmar';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value + 'T12:00:00Z'));
  } catch {
    return value;
  }
};

export function transferFlightDetails(
  v: TransferVoucher,
  returning = false,
): { airline: string; number: string } {
  const combined = ((returning ? v.returnFlight : v.flight) ?? '').trim();
  const airline = returning ? v.returnAirline : v.airline;
  const number = returning ? v.returnFlightNumber : v.flightNumber;

  // Preferir los campos separados si existen y concuerdan con el combinado
  if (
    airline !== undefined &&
    number !== undefined &&
    [airline, number].join(' ').trim() === combined
  ) {
    return { airline, number };
  }

  // Fallback: parsear del campo combinado (vouchers viejos)
  const match = combined.match(
    /^(.+?)\s+([A-Z0-9]{2,3}\s*\d{1,5}[A-Z]?|\d{1,5}[A-Z]?)$/i,
  );
  return match
    ? { airline: match[1], number: match[2] }
    : { airline: '', number: combined };
}
