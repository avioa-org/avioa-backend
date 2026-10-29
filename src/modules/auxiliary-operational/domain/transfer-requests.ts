export const transferOperators = {
  'Santa Marta': {
    name: 'Taximarino',
    emails: ['comercial@taximarino.com', 'reservas@taximarino.com'],
    whatsapp: '',
  },
  Cartagena: {
    name: 'Transturismo',
    emails: ['transturismocartagena@gmail.com'],
    whatsapp: '',
  },
  'San Andrés': {
    name: 'Portofino',
    emails: ['receptivos@portofinocaribe.com'],
    whatsapp: '',
  },
  Palomino: {
    name: 'Taxista asignado · Naio',
    emails: [],
    whatsapp: '573235760342',
  },
  Barú: {
    name: 'Decameron Explorer',
    emails: ['receptivos.explorerbaru@decameron.com'],
    whatsapp: '',
  },
} as const;
export type TransferDestination = keyof typeof transferOperators;
export const transferLabels = {
  advisor: 'Asesor',
  reservationCode: 'Número de reserva iTraffic',
  holder: 'Titular de la reserva',
  phone: 'Teléfono del titular',
  adults: 'Personas mayores de 2 años',
  infants: 'Infantes (0 a 2 años)',
  destination: 'Destino',
  hotel: 'Hotel',
  tours: 'Incluye tours',
  tourNotes: 'Observaciones tours',
  arrivalAirline: 'Aerolínea de llegada',
  arrivalFlight: 'Número de vuelo de llegada',
  arrivalDate: 'Fecha de llegada',
  arrivalTime: 'Hora de llegada',
  returnAirline: 'Aerolínea de regreso',
  returnFlight: 'Número de vuelo de regreso',
  returnDate: 'Fecha de regreso',
  returnTime: 'Hora de regreso',
};
export type TransferRequestData = Record<keyof typeof transferLabels, string>;
export const newTransferRequest = (): TransferRequestData => ({
  advisor: '',
  reservationCode: '',
  holder: '',
  phone: '',
  adults: '1',
  infants: '0',
  destination: '',
  hotel: '',
  tours: 'NO',
  tourNotes: '',
  arrivalAirline: '',
  arrivalFlight: '',
  arrivalDate: '',
  arrivalTime: '',
  returnAirline: '',
  returnFlight: '',
  returnDate: '',
  returnTime: '',
});
export function normalizeTransferRequest(input: unknown): TransferRequestData {
  if (!input || typeof input !== 'object')
    throw Error('Completa los datos de la solicitud.');
  const d = newTransferRequest();
  for (const k of Object.keys(d) as (keyof TransferRequestData)[]) {
    const v = (input as any)[k];
    if (
      typeof v !== 'string' ||
      v.length > (k === 'tourNotes' ? 1200 : 180) ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
    )
      throw Error('Revisa ' + transferLabels[k] + '.');
    d[k] = v.trim();
    if (k !== 'tourNotes' && !d[k])
      throw Error('Completa ' + transferLabels[k] + '.');
  }
  if (!Object.hasOwn(transferOperators, d.destination))
    throw Error('Selecciona un destino válido.');
  if (!/^\+?[\d\s()-]{7,25}$/.test(d.phone))
    throw Error('Revisa el teléfono del titular.');
  if (
    !/^\d+$/.test(d.adults) ||
    +d.adults < 1 ||
    +d.adults > 500 ||
    !/^\d+$/.test(d.infants) ||
    +d.infants > 100
  )
    throw Error('Revisa la cantidad de pasajeros.');
  if (!['SI', 'NO'].includes(d.tours)) throw Error('Indica si incluye tours.');
  if (d.tours === 'SI' && !d.tourNotes)
    throw Error('Indica cuáles tours están incluidos.');
  if (d.tours === 'NO') d.tourNotes = '';
  for (const k of ['arrivalDate', 'returnDate'] as const) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d[k]) ||
      !Number.isFinite(Date.parse(d[k])) ||
      new Date(d[k]).toISOString().slice(0, 10) !== d[k]
    )
      throw Error('Revisa las fechas.');
  }
  for (const k of ['arrivalTime', 'returnTime'] as const)
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d[k]))
      throw Error('Revisa las horas.');
  if (d.returnDate + 'T' + d.returnTime <= d.arrivalDate + 'T' + d.arrivalTime)
    throw Error('El regreso debe ser posterior a la llegada.');
  return d;
}
export const operatorFor = (d: TransferRequestData) =>
  transferOperators[d.destination as TransferDestination];
export const transferSubject = (d: TransferRequestData) =>
  `SOLICITUD Y ASIGNACIÓN DE TRASLADO · ${d.reservationCode.replace(/[\r\n]/g, ' ')} · ${d.destination}`;
export function transferMessage(d: TransferRequestData) {
  return (
    'Cordial saludo.\n\nDesde aVioa solicitamos su apoyo con la gestión del siguiente servicio de traslado para nuestros pasajeros.\n\n' +
    Object.entries(transferLabels)
      .map(([key, label]) => {
        const k = key as keyof TransferRequestData;
        const value = k.endsWith('Date')
          ? d[k].split('-').reverse().join('/')
          : d[k];
        return `${label}: ${value || 'No aplica'}`;
      })
      .join('\n') +
    '\n\nAgradecemos confirmar la aceptación del servicio respondiendo a este mensaje.\nMuchas gracias.\naVioa · Reservas'
  );
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function transferEmailHtml(d: TransferRequestData) {
  return (
    '<div style="font-family:Arial,sans-serif;color:#173e60;max-width:760px"><div style="background:#143e61;color:white;padding:24px"><h1 style="font-size:22px;margin:0">aVioa · Solicitud de traslado</h1></div><div style="padding:24px;line-height:1.7;white-space:pre-wrap">' +
    escape(transferMessage(d)) +
    '</div></div>'
  );
}
export const transferWhatsApp = (d: TransferRequestData) =>
  operatorFor(d).whatsapp
    ? 'https://wa.me/' +
      operatorFor(d).whatsapp +
      '?text=' +
      encodeURIComponent(transferSubject(d) + '\n\n' + transferMessage(d))
    : null;
export type TransferRequestRecord = {
  editVersion?: string;
  voucherId?: string | null;
  id: string;
  data: TransferRequestData;
  state: string;
  createdAt: string;
  createdBy: string;
  sentAt: string | null;
  providerId: string | null;
};
export const transferStateLabels: Record<string, string> = {
  pending: 'Pendiente de envío',
  correction: 'Corrección pendiente de confirmar con el operador',
  sending: 'En proceso · no reenviar',
  sent: 'Aceptado por servicio de correo',
  unknown: 'Envío por verificar',
  manual: 'Envío manual registrado',
  confirmed: 'Confirmado por operador (registro manual)',
};
