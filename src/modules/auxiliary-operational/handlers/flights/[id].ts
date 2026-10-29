import { transferImageKey } from '../../domain/transfer-images';
import { getRuntime } from '../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  auxAudit,
  openAuxData,
} from '../../domain/auxiliary';
import type {
  FlightItineraryRow,
  FlightItinerary,
} from '../../domain/flight-itinerary';

export async function DELETE(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Itinerario inválido.' }, 400);
    const db = getRuntime().DB!,
      row = await db
        .prepare('SELECT * FROM auxop_flight_itineraries WHERE id=?')
        .bind(id)
        .first<FlightItineraryRow>();
    if (!row) return auxJson({ error: 'Itinerario no encontrado.' }, 404);
    if (row.deleted_at) return auxJson({ ok: true });
    const old = await openAuxData<FlightItinerary>(
      row.encrypted_data,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      'flight:' + id,
    );
    const at = new Date().toISOString(),
      result = await db
        .prepare(
          "UPDATE auxop_flight_itineraries SET deleted_at=?,updated_at=?,revision=revision+1,encrypted_data='',reservation_code='' WHERE id=? AND deleted_at IS NULL",
        )
        .bind(at, at, id)
        .run();
    if (result.meta.changes) {
      for (const image of old.images || [])
        try {
          await getRuntime().BUCKET?.delete(
            transferImageKey(id, image, 'flights'),
          );
        } catch {
          /* Deleted itinerario no longer exposes this encrypted file. */
        }
    }
    if (result.meta.changes)
      await auxAudit(db, a.email!, 'flight', id, 'delete');
    return auxJson({ ok: true });
  } catch {
    return auxJson(
      { error: 'No se pudo eliminar el itinerario de vuelos.' },
      503,
    );
  }
}
