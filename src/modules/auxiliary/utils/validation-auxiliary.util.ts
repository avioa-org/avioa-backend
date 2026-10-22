import { z } from 'zod';
import { SaveInput } from '../types/auxiliary.types';
import { applyHotelDefaults, validHotelVoucher } from '../domain/aux-voucher';
import {
  normalizeTransferVoucher,
  validTransferVoucher,
} from '../domain/aux-transfer';
import { normalizeTransferRequest } from '../domain/transfer-requests';
import {
  normalizeFlightItinerary,
  validFlightItinerary,
} from '../domain/flight-itinerary';
import { validQuick } from '../domain/auxiliary-quick-import';
import { quickReplyHtml } from '../domain/quick-reply-html';

const assetSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(160),
    type: z.enum(['image/png', 'image/jpeg']),
    size: z
      .number()
      .int()
      .min(1)
      .max(5 * 1024 * 1024),
  })
  .strict();
const envelope = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['hotel', 'transfer', 'request', 'flight', 'reply']),
    payload: z.unknown(),
    revision: z.number().int().min(0),
    assets: z.array(assetSchema).max(3).default([]),
    state: z.enum(['ready', 'pending', 'manual', 'confirmed']),
  })
  .strict();
export function validateInput(value: unknown): SaveInput {
  const p = envelope.parse(value);
  let payload: SaveInput['payload'];
  if (p.kind === 'hotel') {
    if (!validHotelVoucher(p.payload))
      throw Error(
        'Revisa reserva, fechas, pasajeros, acomodación y confirmación.',
      );
    payload = applyHotelDefaults(p.payload);
  } else if (p.kind === 'transfer') {
    if (!validTransferVoucher(p.payload))
      throw Error(
        'Revisa destino, pasajeros, fechas y confirmación del traslado.',
      );
    payload = normalizeTransferVoucher(p.payload);
  } else if (p.kind === 'request')
    payload = normalizeTransferRequest(p.payload);
  else if (p.kind === 'flight') {
    if (!validFlightItinerary(p.payload))
      throw Error(
        'Indica reserva, pasajeros y confirma la revisión del itinerario.',
      );
    payload = normalizeFlightItinerary(p.payload);
  } else {
    if (!validQuick(p.payload))
      throw Error('Completa título, categoría y respuesta.');
    payload = { ...p.payload, html: quickReplyHtml(p.payload.body) };
  }
  if (p.kind !== 'request' && p.state !== 'ready')
    throw Error('Estado no válido para este documento.');
  if (p.kind === 'request' && p.state === 'ready')
    throw Error('Selecciona el estado de la solicitud.');
  if (p.assets.length && p.kind !== 'flight' && p.kind !== 'transfer')
    throw Error('Este tipo de registro no admite imágenes.');
  if (new Set(p.assets.map((a) => a.id)).size !== p.assets.length)
    throw Error('Hay archivos repetidos.');
  return { ...p, payload };
}
export function recordReference(input: SaveInput) {
  return input.kind === 'reply'
    ? (input.payload as { title: string }).title
    : (input.payload as { reservationCode: string }).reservationCode;
}
export function validImageBytes(bytes: Uint8Array, type: string) {
  return type === 'image/png'
    ? bytes.length > 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    : type === 'image/jpeg' &&
        bytes.length > 4 &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255;
}
