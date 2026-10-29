import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxData,
} from '../../../domain/auxiliary';
import type {
  FlightItinerary,
  FlightItineraryRow,
} from '../../../domain/flight-itinerary';
import { readTransferImage } from '../../../domain/transfer-images-server';

export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Itinerario inválido.' }, 400);
    const row = await getRuntime()
      .DB!.prepare(
        'SELECT * FROM auxop_flight_itineraries WHERE id=? AND deleted_at IS NULL',
      )
      .bind(id)
      .first<FlightItineraryRow>();
    if (!row) return auxJson({ error: 'Itinerario no encontrado.' }, 404);
    const data = await openAuxData<FlightItinerary>(
        row.encrypted_data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        'flight:' + id,
      ),
      image = data.images?.find(
        (img) => img.id === new URL(r.url).searchParams.get('imageId'),
      );
    if (!image || !getRuntime().BUCKET)
      return auxJson({ error: 'Imagen no encontrada.' }, 404);
    const bytes = await readTransferImage(
      getRuntime().BUCKET,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      id,
      image,
      'flights',
    );
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return auxJson({ error: 'No se pudo consultar la imagen.' }, 503);
  }
}
