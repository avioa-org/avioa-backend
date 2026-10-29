import { validTransferImages, type TransferImage } from './transfer-images';
import {
  isTransferTemplate,
  transferProfiles,
  type TransferTemplate,
} from './aux-transfer-profiles';
import { auxDate } from './aux-voucher';
export const transferDestinations = {
  sanandres: 'San Andrés',
  cartagena: 'Cartagena',
  santamarta: 'Santa Marta',
  guajira: 'La Guajira',
  amazonas: 'Amazonas',
  palomino: 'Palomino',
  baru: 'Barú',
} as const;
export type TransferDestination = keyof typeof transferDestinations;
export type TransferVoucher = {
  airline?: string;
  flightNumber?: string;
  returnAirline?: string;
  returnFlightNumber?: string;
  sourceRequestId?: string;
  tours?: boolean;
  tourNotes?: string;
  phone?: string;
  images?: TransferImage[];
  template?: TransferTemplate | 'general';
  destination: TransferDestination;
  service: 'oneway' | 'roundtrip';
  reservationCode: string;
  passengerCount: number;
  passengers: string;
  origin: string;
  dropoff: string;
  date: string;
  time: string;
  flight: string;
  returnDate: string;
  returnTime: string;
  returnFlight: string;
  operator: string;
  operatorReference: string;
  notes: string;
  confirmed: boolean;
};
export function newTransferVoucher(
  destination: TransferDestination = 'sanandres',
): TransferVoucher {
  return {
    destination,
    service: 'roundtrip',
    reservationCode: '',
    passengerCount: 0,
    passengers: '',
    origin: 'Aeropuerto',
    dropoff: '',
    date: '',
    time: '',
    flight: '',
    returnDate: '',
    returnTime: '',
    returnFlight: '',
    operator: '',
    operatorReference: '',
    notes: '',
    confirmed: false,
  };
}
export function normalizeTransferVoucher(v: TransferVoucher): TransferVoucher {
  const p = { ...v };
  for (const key of [
    'reservationCode',
    'passengers',
    'origin',
    'dropoff',
    'flight',
    'operator',
    'operatorReference',
    'notes',
  ] as const)
    p[key] = p[key].trim();
  if (p.service === 'oneway') {
    p.returnDate = '';
    p.returnTime = '';
    p.returnFlight = '';
    p.returnAirline = '';
    p.returnFlightNumber = '';
  } else p.returnFlight = p.returnFlight.trim();
  return p;
}
export function newTourVoucher(
  template: TransferTemplate = 'portofino',
): TransferVoucher {
  return {
    ...newTransferVoucher(transferProfiles[template].destination),
    template,
    service: 'roundtrip',
    origin: 'Aeropuerto',
    dropoff:
      template === 'naio'
        ? 'Naio Hotel & Villas'
        : template === 'decameronbaru'
          ? 'Decameron Barú'
          : '',
    operator: transferProfiles[template].name,
  };
}
export function isTourVoucher(v: TransferVoucher) {
  return isTransferTemplate(v.template);
}
const time = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validTransferVoucher(value: unknown): value is TransferVoucher {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as TransferVoucher,
    keys = [
      ...Object.keys(newTransferVoucher()),
      'template',
      'images',
      'phone',
      'sourceRequestId',
      'tours',
      'tourNotes',
      'airline',
      'flightNumber',
      'returnAirline',
      'returnFlightNumber',
    ];
  if (
    ['airline', 'flightNumber', 'returnAirline', 'returnFlightNumber'].some(
      (k) => {
        const value = (p as unknown as Record<string, unknown>)[k];
        return (
          value !== undefined &&
          (typeof value !== 'string' || value.length > 180)
        );
      },
    )
  )
    return false;
  if (Object.keys(p).some((k) => !keys.includes(k))) return false;
  if (
    p.sourceRequestId !== undefined &&
    (typeof p.sourceRequestId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(p.sourceRequestId))
  )
    return false;
  if (p.tours !== undefined && typeof p.tours !== 'boolean') return false;
  if (
    p.tourNotes !== undefined &&
    (typeof p.tourNotes !== 'string' || p.tourNotes.length > 1200)
  )
    return false;
  if (p.tours === true && !p.tourNotes?.trim()) return false;
  if (
    p.phone !== undefined &&
    (typeof p.phone !== 'string' || p.phone.length > 80)
  )
    return false;
  if (p.images !== undefined && !validTransferImages(p.images)) return false;
  if (
    p.template !== undefined &&
    p.template !== 'general' &&
    !isTransferTemplate(p.template)
  )
    return false;
  if (
    !Object.hasOwn(transferDestinations, p.destination) ||
    !['oneway', 'roundtrip'].includes(p.service) ||
    !Number.isSafeInteger(p.passengerCount) ||
    p.passengerCount < 1 ||
    p.passengerCount > 600 ||
    p.confirmed !== true
  )
    return false;
  const strings = [
    'reservationCode',
    'passengers',
    'origin',
    'dropoff',
    'date',
    'time',
    'flight',
    'returnDate',
    'returnTime',
    'returnFlight',
    'operator',
    'operatorReference',
    'notes',
  ] as const;
  if (
    strings.some(
      (k) =>
        typeof p[k] !== 'string' ||
        p[k].length > (['passengers', 'notes'].includes(k) ? 6000 : 400),
    )
  )
    return false;
  if (isTransferTemplate(p.template))
    return (
      p.destination === transferProfiles[p.template].destination &&
      !!p.passengers.trim() &&
      !!p.dropoff.trim() &&
      auxDate(p.date) &&
      (!p.time || time(p.time)) &&
      (!p.returnTime || time(p.returnTime)) &&
      (p.service !== 'roundtrip' || !!p.returnDate) &&
      (!p.returnDate || (auxDate(p.returnDate) && p.returnDate >= p.date)) &&
      (p.service !== 'roundtrip' ||
        p.returnDate !== p.date ||
        !p.time ||
        !p.returnTime ||
        p.returnTime > p.time)
    );
  if (
    !['reservationCode', 'passengers', 'origin', 'dropoff'].every((k) =>
      String(p[k]).trim(),
    ) ||
    !auxDate(p.date) ||
    !time(p.time)
  )
    return false;
  return (
    p.service === 'oneway' ||
    (auxDate(p.returnDate) &&
      time(p.returnTime) &&
      (p.returnDate > p.date ||
        (p.returnDate === p.date && p.returnTime > p.time)))
  );
}
export type SavedTransferVoucher = {
  id: string;
  data: TransferVoucher;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
export type TransferVoucherRow = {
  id: string;
  destination: string;
  reservation_code: string;
  encrypted_data: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_operation: string;
};
