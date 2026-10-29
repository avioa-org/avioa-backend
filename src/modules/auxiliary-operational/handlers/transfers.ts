import {
  prepareTransferImages,
  storeTransferImage,
} from '../domain/transfer-images-server';
import {
  TRANSFER_IMAGE_LIMIT,
  transferImageKey,
} from '../domain/transfer-images';
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
  validTransferVoucher,
  normalizeTransferVoucher,
  isTourVoucher,
  transferDestinations,
  type TransferVoucher,
  type TransferVoucherRow,
} from '../domain/aux-transfer';

async function dto(row: TransferVoucherRow) {
  return {
    id: row.id,
    data: await openAuxData<TransferVoucher>(
      row.encrypted_data,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      'transfer:' + row.id,
    ),
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const params = new URL(r.url).searchParams,
      q = (params.get('q') || '').trim().slice(0, 200),
      destination = params.get('destination') || '';
    if (destination && !Object.hasOwn(transferDestinations, destination))
      return auxJson({ error: 'Destino inválido.' }, 400);
    const pageValue = Number(params.get('page') || 1),
      page = Number.isSafeInteger(pageValue)
        ? Math.max(1, Math.min(10000, pageValue))
        : 1;
    const where =
        "deleted_at IS NULL AND instr(lower(reservation_code),lower(?))>0 AND (?='' OR destination=?)",
      db = getRuntime().DB!;
    const count = await db
      .prepare('SELECT COUNT(*) n FROM auxop_transfer_vouchers WHERE ' + where)
      .bind(q, destination, destination)
      .first<{ n: number }>();
    const rows = (
      await db
        .prepare(
          'SELECT * FROM auxop_transfer_vouchers WHERE ' +
            where +
            ' ORDER BY updated_at DESC,id LIMIT 25 OFFSET ?',
        )
        .bind(q, destination, destination, (page - 1) * 25)
        .all<TransferVoucherRow>()
    ).results;
    return auxJson({
      vouchers: await Promise.all(rows.map(dto)),
      total: count?.n || 0,
      pages: Math.max(1, Math.ceil((count?.n || 0) / 25)),
      page,
    });
  } catch {
    return auxJson(
      { error: 'No se pudieron consultar los vouchers de traslados.' },
      503,
    );
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  const uploaded: string[] = [];
  let committed = false;
  try {
    if (Number(r.headers.get('content-length')) > 18 * 1024 * 1024)
      return auxJson({ error: 'La carga supera 18 MB.' }, 413);
    const form = r.headers.get('content-type')?.includes('multipart/form-data')
      ? await r.formData()
      : null;
    const files = form ? (form.getAll('images') as File[]) : [];
    const raw = form ? String(form.get('payload') || '') : await r.text();
    if (raw.length > 30000)
      return auxJson({ error: 'El voucher contiene demasiado texto.' }, 413);
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return auxJson({ error: 'Datos inválidos.' }, 400);
    }
    if (
      !p ||
      !validTransferVoucher(p.data) ||
      !auxUuid(p.requestId) ||
      (p.id && !auxUuid(p.id)) ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < 0
    )
      return auxJson(
        {
          error:
            'Revisa los campos obligatorios del formato y marca la confirmación. En los formatos de operador: fecha, hotel, cantidad de personas y titular de la reserva.',
        },
        400,
      );
    const data = normalizeTransferVoucher(p.data);
    if (isTourVoucher(data) && !data.reservationCode)
      data.reservationCode =
        'TR-' + p.requestId.replace(/-/g, '').slice(0, 12).toUpperCase();
    const db = getRuntime().DB!,
      id = p.id || p.requestId,
      old = await db
        .prepare('SELECT * FROM auxop_transfer_vouchers WHERE id=?')
        .bind(id)
        .first<TransferVoucherRow>();
    if (old?.deleted_at)
      return auxJson(
        { error: 'Este voucher fue eliminado. Crea uno nuevo.' },
        409,
      );
    if ((data.images?.length || 0) + files.length > TRANSFER_IMAGE_LIMIT)
      return auxJson(
        { error: 'Puedes adjuntar hasta 3 imágenes por voucher.' },
        400,
      );
    const oldData = old ? await dto(old) : null;
    const retained = data.images || [];
    if (
      retained.some(
        (image) =>
          !oldData?.data.images?.some(
            (saved) => JSON.stringify(saved) === JSON.stringify(image),
          ),
      )
    )
      return auxJson(
        {
          error: 'Una imagen no pertenece a este voucher. Vuelve a adjuntarla.',
        },
        400,
      );
    let prepared;
    try {
      prepared = await prepareTransferImages(files, p.requestId);
    } catch (error) {
      return auxJson({ error: (error as Error).message }, 400);
    }
    if (old?.last_operation === p.requestId)
      prepared.forEach((item, index) => {
        const stored = oldData?.data.images?.[retained.length + index];
        if (stored) item.image.id = stored.id;
      });
    if (files.length)
      data.images = [...retained, ...prepared.map((item) => item.image)];
    if (old && old.last_operation === p.requestId) {
      const saved = await dto(old);
      if (JSON.stringify(saved.data) !== JSON.stringify(data))
        return auxJson(
          { error: 'Esa operación corresponde a otros datos.' },
          409,
        );
      return auxJson({ voucher: saved, replayed: true });
    }
    if ((old?.revision || 0) !== p.revision)
      return auxJson(
        {
          error: 'El voucher cambió. Abre la versión actual antes de guardar.',
        },
        409,
      );
    if (prepared.length && !getRuntime().BUCKET)
      return auxJson(
        { error: 'No está disponible el almacenamiento de imágenes.' },
        503,
      );
    for (const item of prepared) {
      const key = transferImageKey(id, item.image);
      uploaded.push(key);
      await storeTransferImage(
        getRuntime().BUCKET!,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
        item.image,
        item.bytes,
      );
    }
    const at = new Date().toISOString(),
      cipher = await sealAuxData(
        data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        'transfer:' + id,
      );
    const result = old
      ? await db
          .prepare(
            'UPDATE auxop_transfer_vouchers SET destination=?,reservation_code=?,encrypted_data=?,revision=revision+1,updated_at=?,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL',
          )
          .bind(
            data.destination,
            data.reservationCode,
            cipher,
            at,
            p.requestId,
            id,
            p.revision,
          )
          .run()
      : await db
          .prepare(
            'INSERT OR IGNORE INTO auxop_transfer_vouchers(id,destination,reservation_code,encrypted_data,revision,created_by,created_at,updated_at,last_operation) VALUES(?,?,?,?,1,?,?,?,?)',
          )
          .bind(
            id,
            data.destination,
            data.reservationCode,
            cipher,
            a.email,
            at,
            at,
            p.requestId,
          )
          .run();
    if (!result.meta.changes) {
      for (const key of uploaded) await getRuntime().BUCKET?.delete(key);
      uploaded.length = 0;
      return auxJson(
        { error: 'El voucher cambió. Actualiza antes de guardar.' },
        409,
      );
    }
    committed = true;
    for (const image of oldData?.data.images || [])
      if (!data.images?.some((next) => next.id === image.id))
        try {
          await getRuntime().BUCKET?.delete(transferImageKey(id, image));
        } catch {
          /* Detached encrypted file is inaccessible. */
        }
    await auxAudit(db, a.email!, 'transfer', id, old ? 'update' : 'create');
    const saved = await db
      .prepare(
        'SELECT * FROM auxop_transfer_vouchers WHERE id=? AND deleted_at IS NULL',
      )
      .bind(id)
      .first<TransferVoucherRow>();
    if (!saved)
      return auxJson(
        { error: 'El voucher fue eliminado en otra sesión.' },
        409,
      );
    return auxJson({ voucher: await dto(saved) });
  } catch {
    if (!committed)
      for (const key of uploaded)
        try {
          await getRuntime().BUCKET?.delete(key);
        } catch {}
    return auxJson(
      { error: 'No se pudo guardar el voucher de traslado.' },
      503,
    );
  }
}
