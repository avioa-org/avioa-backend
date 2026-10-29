import { hotelVoucherMetadata } from './hotel-voucher-metadata';
export const voucherTemplates = {
  general: 'General aVioa',
  cataloniabavaro: 'Catalonia Bávaro Beach · Familiar · Todo Incluido',
  cataloniaroyalbavaro: 'Catalonia Royal Bávaro · Solo adultos · Todo Incluido',
  delmarsantamarta: 'Hotel del Mar Santa Marta · Con desayuno',
  irotama: 'Irotama Santa Marta · Con desayuno',
  naio: 'Naio Palomino · Con desayuno',
  solcaribecampo: 'Sol Caribe Campo · Todo Incluido',
  solcaribecentro: 'Sol Caribe Centro · Todo Incluido',
  dubaicartagena: 'Dubai Cartagena · Todo Incluido',
  cartagenaplaza: 'Hotel Cartagena Plaza · Todo Incluido',
  tamaca: 'Tamacá Beach · Con desayuno',
  blutamaca: 'Blu by Tamacá · Con desayuno',
  verdemar: 'Hotel Verde Mar',
  sunrise: 'GHL Sunrise · Plan PAE',
  sirenis: 'Grand Sirenis Cartagena',
  dorado: 'Dorado Plaza Cartagena',
  sirenissanandres: 'Grand Sirenis San Andrés',
} as const;
export const voucherContacts = {
  service: 'Servicio al cliente: 302 4394299',
  commercial: 'Comercial: 300 3732122',
  email: 'Viajes@avioa.co',
} as const;
export const voucherSupportContact = Object.values(voucherContacts).join(' · ');
export type HotelVoucher = {
  passengerCount?: number;
  template?: keyof typeof voucherTemplates;
  accommodation?: string;
  destination?: string;
  soldBy?: string;
  checkInTime?: string;
  checkOutTime?: string;
  reservationCode: string;
  operatorReference: string;
  operator: string;
  hotelName: string;
  hotelAddress: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  passengers: string;
  roomType: string;
  mealPlan: string;
  included: string;
  notes: string;
  supportContact: string;
  confirmed: boolean;
};
export const emptyHotelVoucher: HotelVoucher = {
  passengerCount: undefined,
  template: 'general',
  accommodation: '',
  destination: '',
  soldBy: '',
  checkInTime: '',
  checkOutTime: '',
  reservationCode: '',
  operatorReference: '',
  operator: '',
  hotelName: '',
  hotelAddress: '',
  checkIn: '',
  checkOut: '',
  adults: 0,
  children: 0,
  rooms: 0,
  passengers: '',
  roomType: '',
  mealPlan: '',
  included: '',
  notes: '',
  supportContact: '',
  confirmed: false,
};
export const hotelVoucherDefaults = Object.fromEntries(
  Object.entries(hotelVoucherMetadata).map(([key, p]) => [
    key,
    {
      hotelName: p.hotelName,
      destination: p.destination,
      hotelAddress: p.hotelAddress,
      mealPlan: p.mealPlan,
      notes: p.notes,
      checkInTime: p.checkInTime || '',
      checkOutTime: p.checkOutTime || '',
      supportContact: voucherSupportContact,
    },
  ]),
) as Record<string, Partial<HotelVoucher>>;
export const isHotelTemplate = (v: HotelVoucher) =>
  !!v.template && Object.hasOwn(hotelVoucherMetadata, v.template);
export function hotelTemplateForName(
  name: string,
): keyof typeof voucherTemplates | undefined {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/catalonia/.test(s) && /royal/.test(s) && /bavaro/.test(s))
    return 'cataloniaroyalbavaro';
  if (/catalonia/.test(s) && /bavaro/.test(s) && !/royal/.test(s))
    return 'cataloniabavaro';
  if (/(?:hotel\s*del\s*mar|del\s*mar\s*hotel)/.test(s))
    return 'delmarsantamarta';
  if (/irotama/.test(s)) return 'irotama';
  if (/\b(?:naio|nayo)\b/.test(s)) return 'naio';
  if (/sol\s*caribe/.test(s) && /campo/.test(s)) return 'solcaribecampo';
  if (/sol\s*caribe/.test(s) && /centro|san\s*andres/.test(s))
    return 'solcaribecentro';
  if (/dubai/.test(s) && /cartagena/.test(s)) return 'dubaicartagena';
  if (/cartagena\s*plaza/.test(s)) return 'cartagenaplaza';
  if (/blu/.test(s) && /tamaca/.test(s)) return 'blutamaca';
  if (/tamaca/.test(s)) return 'tamaca';
  if (/verde\s*mar/.test(s)) return 'verdemar';
  if (/sunrise/.test(s)) return 'sunrise';
  if (/sirenis/.test(s) && /san\s*andres/.test(s)) return 'sirenissanandres';
  if (/sirenis/.test(s) && /cartagena/.test(s)) return 'sirenis';
  if (/dorado.*plaza/.test(s) && /bocagrande|cartagena/.test(s))
    return 'dorado';
}
export function applyHotelDefaults(v: HotelVoucher): HotelVoucher {
  if (!isHotelTemplate(v)) return { ...v };
  const defaults =
    hotelVoucherDefaults[v.template as keyof typeof hotelVoucherDefaults];
  return {
    ...v,
    operator: '',
    hotelAddress: '',
    checkInTime: '',
    checkOutTime: '',
    soldBy: '',
    roomType: '',
    included: '',
    ...defaults,
    supportContact: voucherSupportContact,
    accommodation: v.accommodation?.trim() || v.roomType,
  };
}
export function newHotelVoucher(
  template: keyof typeof voucherTemplates = 'verdemar',
): HotelVoucher {
  return applyHotelDefaults({ ...emptyHotelVoucher, template });
}
export function voucherFormLabels(v: HotelVoucher) {
  return Object.entries(voucherLabels).filter(([k]) =>
    isHotelTemplate(v)
      ? [
          'reservationCode',
          'passengerCount',
          'checkIn',
          'checkOut',
          'passengers',
          'accommodation',
        ].includes(k)
      : !['checkInTime', 'checkOutTime', 'operator', 'hotelAddress'].includes(
          k,
        ),
  );
}
export const voucherLabels = {
  passengerCount: 'Cantidad de pasajeros',
  accommodation: 'Acomodación · camas y distribución',
  destination: 'Destino',
  soldBy: 'Vendido por',
  checkInTime: 'Hora de entrada · confirmada por el hotel',
  checkOutTime: 'Hora de salida · confirmada por el hotel',
  reservationCode: 'Número de reserva · será el número del voucher',
  operatorReference: 'Confirmación del hotel u operador',
  operator: 'Operador',
  hotelName: 'Hotel',
  hotelAddress: 'Dirección del hotel',
  checkIn: 'Fecha de entrada',
  checkOut: 'Fecha de salida',
  adults: 'Adultos',
  children: 'Niños',
  rooms: 'Habitaciones',
  passengers: 'Datos de pax · nombre, documento y nacimiento por línea',
  roomType: 'Tipo de habitación',
  mealPlan: 'Plan de alimentación',
  included: 'Servicios incluidos',
  notes: 'Observaciones para el pasajero',
  supportContact: 'Contacto de soporte',
} as const;
export function auxDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '1900-01-01' ||
    value > '2200-12-31'
  )
    return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validHotelVoucher(value: unknown): value is HotelVoucher {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as HotelVoucher;
  if (
    p.passengerCount !== undefined &&
    (!Number.isSafeInteger(p.passengerCount) ||
      p.passengerCount < 1 ||
      p.passengerCount > 100)
  )
    return false;
  if (p.template !== undefined && !Object.hasOwn(voucherTemplates, p.template))
    return false;
  for (const k of [
    'accommodation',
    'destination',
    'soldBy',
    'checkInTime',
    'checkOutTime',
  ] as const)
    if (p[k] !== undefined && (typeof p[k] !== 'string' || p[k].length > 400))
      return false;
  const keys = [
    'reservationCode',
    'operatorReference',
    'operator',
    'hotelName',
    'hotelAddress',
    'checkIn',
    'checkOut',
    'passengers',
    'roomType',
    'mealPlan',
    'included',
    'notes',
    'supportContact',
  ] as const;
  if (Object.keys(value).some((k) => !Object.hasOwn(emptyHotelVoucher, k)))
    return false;
  if (
    !keys.every(
      (k) =>
        typeof p[k] === 'string' &&
        p[k].length <=
          (['passengers', 'included', 'notes'].includes(k) ? 6000 : 400),
    )
  )
    return false;
  const simple = isHotelTemplate(p);
  return (
    (simple
      ? !!p.passengers.trim() &&
        !!p.hotelName.trim() &&
        !!(
          p.accommodation?.trim() ||
          p.roomType.trim() ||
          (p.adults > 0 && p.rooms > 0)
        )
      : [
          'reservationCode',
          'operatorReference',
          'hotelName',
          'passengers',
        ].every((k) => String(p[k as keyof HotelVoucher]).trim())) &&
    auxDate(p.checkIn) &&
    auxDate(p.checkOut) &&
    p.checkOut > p.checkIn &&
    Number.isSafeInteger(p.adults) &&
    p.adults >= (simple ? 0 : 1) &&
    p.adults <= 100 &&
    Number.isSafeInteger(p.children) &&
    p.children >= 0 &&
    p.children <= 100 &&
    Number.isSafeInteger(p.rooms) &&
    p.rooms >= (simple ? 0 : 1) &&
    p.rooms <= 100 &&
    p.confirmed === true
  );
}
export type SavedHotelVoucher = {
  id: string;
  data: HotelVoucher;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
export type VoucherRow = {
  id: string;
  reservation_code: string;
  encrypted_data: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_operation: string;
};
