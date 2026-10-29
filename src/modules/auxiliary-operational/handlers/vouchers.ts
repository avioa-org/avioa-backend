import { getRuntime } from '../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  sealAuxData,
  openAuxData,
  auxAudit,
} from '../domain/auxiliary';
import {
  validHotelVoucher,
  applyHotelDefaults,
  type HotelVoucher,
  type VoucherRow,
} from '../domain/aux-voucher';

export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const q = (new URL(r.url).searchParams.get('q') || '').trim().slice(0, 200);
    const rows = (
      await getRuntime()
        .DB!.prepare(
          'SELECT * FROM auxop_vouchers WHERE deleted_at IS NULL AND instr(lower(reservation_code),lower(?))>0 ORDER BY updated_at DESC LIMIT 50',
        )
        .bind(q)
        .all<VoucherRow>()
    ).results;
    return auxJson({
      vouchers: await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          data: await openAuxData<HotelVoucher>(
            row.encrypted_data,
            getRuntime().VAULT_ENCRYPTION_KEY!,
            row.id,
          ),
          revision: row.revision,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      ),
    });
  } catch {
    return auxJson({ error: 'No se pudieron consultar los vouchers.' }, 503);
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const raw = await r.text();
    if (raw.length > 30000)
      return auxJson({ error: 'El voucher tiene demasiado texto.' }, 413);
    const p = JSON.parse(raw);
    if (
      !validHotelVoucher(p.data) ||
      !auxUuid(p.requestId) ||
      (p.id && !auxUuid(p.id)) ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < 0
    )
      return auxJson(
        {
          error:
            'Completa las fechas de viaje, los datos del pasajero y la acomodación. La salida debe ser posterior a la entrada. Confirma que revisaste los datos.',
        },
        400,
      );
    p.data = applyHotelDefaults(p.data);
    const db = getRuntime().DB!,
      id = p.id || p.requestId,
      old = await db
        .prepare('SELECT * FROM auxop_vouchers WHERE id=?')
        .bind(id)
        .first<VoucherRow>();
    if (old?.deleted_at)
      return auxJson(
        { error: 'Este voucher fue eliminado. Crea un voucher nuevo.' },
        409,
      );
    if (old && old.last_operation === p.requestId) {
      const saved = await openAuxData<HotelVoucher>(
        old.encrypted_data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
      );
      if (JSON.stringify(saved) !== JSON.stringify(p.data))
        return auxJson(
          { error: 'La operación ya se guardó con otros datos.' },
          409,
        );
      return auxJson({
        voucher: {
          id,
          data: saved,
          revision: old.revision,
          createdBy: old.created_by,
          createdAt: old.created_at,
          updatedAt: old.updated_at,
        },
        replayed: true,
      });
    }
    if (old?.deleted_at || (old?.revision || 0) !== p.revision)
      return auxJson(
        { error: 'El voucher cambió. Actualiza antes de guardar.' },
        409,
      );
    const at = new Date().toISOString(),
      cipher = await sealAuxData(
        p.data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
      );
    const result = old
      ? await db
          .prepare(
            'UPDATE auxop_vouchers SET reservation_code=?,encrypted_data=?,revision=revision+1,updated_at=?,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL',
          )
          .bind(p.data.reservationCode, cipher, at, p.requestId, id, p.revision)
          .run()
      : await db
          .prepare(
            'INSERT OR IGNORE INTO auxop_vouchers(id,reservation_code,encrypted_data,revision,created_by,created_at,updated_at,last_operation) VALUES(?,?,?,1,?,?,?,?)',
          )
          .bind(
            id,
            p.data.reservationCode,
            cipher,
            a.email,
            at,
            at,
            p.requestId,
          )
          .run();
    if (!result.meta.changes)
      return auxJson(
        { error: 'El voucher cambió. Actualiza antes de guardar.' },
        409,
      );
    await auxAudit(db, a.email!, 'voucher', id, old ? 'update' : 'create');
    const saved = await db
      .prepare('SELECT * FROM auxop_vouchers WHERE id=?')
      .bind(id)
      .first<VoucherRow>();
    return auxJson({
      voucher: {
        id,
        data: p.data,
        revision: saved!.revision,
        createdBy: saved!.created_by,
        createdAt: saved!.created_at,
        updatedAt: saved!.updated_at,
      },
    });
  } catch {
    return auxJson({ error: 'No se pudo guardar el voucher.' }, 503);
  }
}
