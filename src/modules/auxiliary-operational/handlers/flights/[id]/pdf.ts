import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxData,
} from '../../../domain/auxiliary';
import {
  validFlightItinerary,
  type FlightItinerary,
  type FlightItineraryRow,
} from '../../../domain/flight-itinerary';
import { readTransferImage } from '../../../domain/transfer-images-server';
import { buildFlightItineraryPdf } from '../../../domain/flight-itinerary-pdf';

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
    );
    if (
      !validFlightItinerary(data) ||
      !data.images?.length ||
      !getRuntime().BUCKET
    )
      return auxJson(
        {
          error:
            'El itinerario no tiene una imagen disponible. Abre el formato y vuelve a adjuntarla.',
        },
        400,
      );
    const images: {
      image: import('../../../domain/transfer-images').TransferImage;
      bytes: Uint8Array;
    }[] = [];
    for (const image of data.images)
      images.push({
        image,
        bytes: await readTransferImage(
          getRuntime().BUCKET,
          getRuntime().VAULT_ENCRYPTION_KEY!,
          id,
          image,
          'flights',
        ),
      });
    const bytes = await buildFlightItineraryPdf(data, images),
      filename =
        'itinerario-vuelos-' +
        data.reservationCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) +
        '.pdf';
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return auxJson(
      {
        error:
          'No se pudo generar el PDF. Revisa las imágenes y los datos de los pasajeros.',
      },
      503,
    );
  }
}
