import {
  newTransferVoucher,
  validTransferVoucher,
  type TransferDestination,
  type TransferVoucher,
} from './aux-transfer';
import type { TransferTemplate } from './aux-transfer-profiles';
import { operatorFor, TransferRequestData } from './transfer-requests';

const destinations: Record<string, TransferDestination> = {
  'Santa Marta': 'santamarta',
  Cartagena: 'cartagena',
  'San Andrés': 'sanandres',
  Palomino: 'palomino',
  Barú: 'baru',
};
export const requestVoucherTemplates: Partial<
  Record<TransferDestination, TransferTemplate>
> = {
  sanandres: 'portofino',
  santamarta: 'taximarino',
  cartagena: 'transturismo',
  palomino: 'naio',
  baru: 'decameronbaru',
};

export function voucherFromTransferRequest(
  d: TransferRequestData,
  id: string,
): TransferVoucher {
  const destination = destinations[d.destination];
  if (!destination) throw Error('Este destino requiere su formulario externo.');
  const v: TransferVoucher = {
    ...newTransferVoucher(destination),
    template: requestVoucherTemplates[destination] || 'general',
    sourceRequestId: id,
    reservationCode: d.reservationCode,
    passengerCount: Number(d.adults) + Number(d.infants),
    passengers: d.holder,
    phone: d.phone,
    dropoff: d.hotel,
    date: d.arrivalDate,
    time: d.arrivalTime,
    airline: d.arrivalAirline,
    flightNumber: d.arrivalFlight,
    returnAirline: d.returnAirline,
    returnFlightNumber: d.returnFlight,
    flight: [d.arrivalAirline, d.arrivalFlight].join(' '),
    returnDate: d.returnDate,
    returnTime: d.returnTime,
    returnFlight: [d.returnAirline, d.returnFlight].join(' '),
    operator: operatorFor(d).name,
    tours: d.tours === 'SI',
    tourNotes: d.tours === 'SI' ? d.tourNotes.trim() : '',
    notes: `Personas mayores de 2 años: ${d.adults}. Infantes (0 a 2 años): ${d.infants}.\nTeléfono del titular: ${d.phone}.`,
    confirmed: true,
  };
  if (!validTransferVoucher(v))
    throw Error('Revisa los datos de la solicitud para preparar el voucher.');
  return v;
}
