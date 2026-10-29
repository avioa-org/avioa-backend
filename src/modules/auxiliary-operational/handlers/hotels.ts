import { getRuntime } from '../runtime';
import { auxJson } from '../domain/auxiliary';
export async function GET(request: Request) {
  const avi = (new URL(request.url).searchParams.get('avi') || '')
    .trim()
    .toUpperCase();
  if (!avi || avi.length > 200)
    return auxJson({ error: 'Escribe el código AVI de la reserva.' }, 400);
  const rows = await getRuntime()
    .DB.prepare(
      'SELECT id,reservation_code,operator_reference,operator,hotel_name,check_in,contact_name,updated_at FROM auxop_hotel_catalog WHERE upper(trim(reservation_code))=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100',
    )
    .bind(avi)
    .all<any>();
  return auxJson({
    hotels: rows.results.map((r) => ({
      id: r.id,
      reservationCode: r.reservation_code,
      operatorReference: r.operator_reference,
      operator: r.operator,
      hotelName: r.hotel_name,
      checkIn: r.check_in,
      contactName: r.contact_name,
      updatedAt: r.updated_at,
    })),
    source: 'Catálogo operativo sincronizado por AVI',
  });
}
