import type { TransferVoucher } from './aux-transfer';

export const transferLongDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value + 'T12:00:00Z'))
    : 'Por confirmar';

export function transferFlightDetails(v: TransferVoucher, returning = false) {
  const combined = (returning ? v.returnFlight : v.flight).trim();
  const airline = returning ? v.returnAirline : v.airline;
  const number = returning ? v.returnFlightNumber : v.flightNumber;
  // Prefer the original separate request fields, unless a later edit changed the flight.
  if (
    airline !== undefined &&
    number !== undefined &&
    [airline, number].join(' ').trim() === combined
  )
    return { airline, number };
  // Compatibility for vouchers saved before separate airline and flight fields existed.
  const match = combined.match(
    /^(.+?)\s+([A-Z0-9]{2,3}\s*\d{1,5}[A-Z]?|\d{1,5}[A-Z]?)$/i,
  );
  return match
    ? { airline: match[1], number: match[2] }
    : { airline: '', number: combined };
}
