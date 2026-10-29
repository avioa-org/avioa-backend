import { voucherFromTransferRequest } from '../domain/transfer-request-voucher';
import type {
  TransferVoucher,
  TransferVoucherRow,
} from '../domain/aux-transfer';
import { getRuntime } from '../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  sealAuxData,
  openAuxData,
} from '../domain/auxiliary';
import {
  normalizeTransferRequest,
  operatorFor,
  transferSubject,
  transferMessage,
  transferEmailHtml,
  type TransferRequestData,
} from '../domain/transfer-requests';

type Row = {
  id: string;
  fingerprint: string;
  encrypted_data: string;
  state: string;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  provider_id: string | null;
};
const settings = () => ({
  key: getRuntime().TRANSFER_RESEND_API_KEY,
  enabled: getRuntime().TRANSFER_EMAIL_ENABLED === 'true',
});
const configured = () => !!settings().key && settings().enabled;
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
async function dto(row: Row) {
  const voucher = await getRuntime()
    .DB!.prepare(
      'SELECT id FROM auxop_transfer_vouchers WHERE id=? AND deleted_at IS NULL',
    )
    .bind(row.id)
    .first<{ id: string }>();
  return {
    editVersion: await digest(row.encrypted_data),
    voucherId: voucher?.id || null,
    id: row.id,
    data: await openAuxData<TransferRequestData>(
      row.encrypted_data,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      'request:' + row.id,
    ),
    state: row.state,
    createdBy: row.created_by,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    providerId: row.provider_id,
  };
}
async function ensureVoucher(row: Row, email: string) {
  const db = getRuntime().DB!,
    existing = await db
      .prepare('SELECT id,deleted_at FROM auxop_transfer_vouchers WHERE id=?')
      .bind(row.id)
      .first<{ id: string; deleted_at: string | null }>();
  if (existing) {
    if (existing.deleted_at)
      throw Error(
        'El voucher vinculado fue eliminado. Crea una nueva solicitud para preparar otro.',
      );
    return row.id;
  }
  const d = await openAuxData<TransferRequestData>(
    row.encrypted_data,
    getRuntime().VAULT_ENCRYPTION_KEY!,
    'request:' + row.id,
  );
  const v = voucherFromTransferRequest(d, row.id),
    at = new Date().toISOString();
  const cipher = await sealAuxData(
    v,
    getRuntime().VAULT_ENCRYPTION_KEY!,
    'transfer:' + row.id,
  );
  await db
    .prepare(
      'INSERT OR IGNORE INTO auxop_transfer_vouchers(id,destination,reservation_code,encrypted_data,revision,created_by,created_at,updated_at,last_operation) VALUES(?,?,?,?,1,?,?,?,?)',
    )
    .bind(
      row.id,
      v.destination,
      v.reservationCode,
      cipher,
      email,
      at,
      at,
      row.id,
    )
    .run();
  const saved = await db
    .prepare('SELECT id,deleted_at FROM auxop_transfer_vouchers WHERE id=?')
    .bind(row.id)
    .first<{ id: string; deleted_at: string | null }>();
  if (!saved || saved.deleted_at)
    throw Error('El voucher cambió en otra sesión. Actualiza la solicitud.');
  return row.id;
}
async function prepareVoucher(row: Row, email: string) {
  try {
    await ensureVoucher(row, email);
    return null;
  } catch (e) {
    return auxJson({ error: (e as Error).message }, 409);
  }
}
export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const rows = (
      await getRuntime()
        .DB!.prepare(
          "SELECT * FROM auxop_transfer_requests WHERE state<>'deleted' ORDER BY created_at DESC LIMIT 100",
        )
        .all<Row>()
    ).results;
    return auxJson({
      records: await Promise.all(rows.map(dto)),
      emailConfigured: configured(),
    });
  } catch {
    return auxJson({ error: 'No se pudieron cargar las solicitudes.' }, 503);
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const raw = await r.text();
    if (raw.length > 16000)
      return auxJson({ error: 'La solicitud es demasiado extensa.' }, 413);
    const p = JSON.parse(raw),
      db = getRuntime().DB!;
    if (p.action === 'save') {
      if (!auxUuid(p.requestId))
        return auxJson({ error: 'Identificador inválido.' }, 400);
      let d: TransferRequestData;
      try {
        d = normalizeTransferRequest(p.data);
      } catch (e) {
        return auxJson({ error: (e as Error).message }, 400);
      }
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(JSON.stringify(d)),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      const cipher = await sealAuxData(
          d,
          getRuntime().VAULT_ENCRYPTION_KEY!,
          'request:' + p.requestId,
        ),
        at = new Date().toISOString();
      await db
        .prepare(
          "INSERT OR IGNORE INTO auxop_transfer_requests(id,fingerprint,encrypted_data,state,created_by,created_at) VALUES(?,?,?,'pending',?,?)",
        )
        .bind(p.requestId, fingerprint, cipher, a.email, at)
        .run();
      const row = await db
        .prepare('SELECT * FROM auxop_transfer_requests WHERE fingerprint=?')
        .bind(fingerprint)
        .first<Row>();
      if (!row)
        return auxJson(
          {
            error:
              'Identificador usado con otros datos. Inicia una nueva solicitud.',
          },
          409,
        );
      const failure = await prepareVoucher(row, a.email!);
      if (failure) return failure;
      return auxJson({ record: await dto(row), emailConfigured: configured() });
    }
    if (!auxUuid(p.id)) return auxJson({ error: 'Solicitud inválida.' }, 400);
    const row = await db
      .prepare('SELECT * FROM auxop_transfer_requests WHERE id=?')
      .bind(p.id)
      .first<Row>();
    if (!row) return auxJson({ error: 'Solicitud no encontrada.' }, 404);
    if (p.action === 'delete') {
      if (p.confirmed !== true)
        return auxJson(
          { error: 'Confirma que deseas eliminar esta solicitud.' },
          400,
        );
      if (row.state === 'deleted') return auxJson({ ok: true });
      if (row.state === 'sending')
        return auxJson(
          {
            error:
              'La solicitud se está enviando. Espera a que termine antes de eliminarla.',
          },
          409,
        );
      const at = new Date().toISOString();
      const results = await db.batch([
        db
          .prepare(
            'INSERT INTO auxop_audit(id,entity,target,action,by,at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM auxop_transfer_requests WHERE id=? AND state=?)',
          )
          .bind(
            crypto.randomUUID(),
            'transfer_request',
            p.id,
            'delete',
            a.email,
            at,
            p.id,
            row.state,
          ),
        db
          .prepare(
            "UPDATE auxop_transfer_requests SET state='deleted',fingerprint='deleted:'||id WHERE id=? AND state=?",
          )
          .bind(p.id, row.state),
      ]);
      if (!results[1].meta.changes) {
        const current = await db
          .prepare('SELECT state FROM auxop_transfer_requests WHERE id=?')
          .bind(p.id)
          .first<{ state: string }>();
        if (current?.state !== 'deleted')
          return auxJson(
            {
              error:
                'La solicitud cambió en otra sesión. Actualiza antes de eliminarla.',
            },
            409,
          );
      }
      return auxJson({ ok: true });
    }
    if (row.state === 'deleted')
      return auxJson(
        { error: 'Esta solicitud fue eliminada. Actualiza la lista.' },
        404,
      );
    if (p.action === 'updateTours') {
      if (row.state === 'sending')
        return auxJson(
          {
            error:
              'La solicitud se está enviando. Espera a que termine antes de editarla.',
          },
          409,
        );
      if (
        typeof p.editVersion !== 'string' ||
        p.editVersion !== (await digest(row.encrypted_data))
      )
        return auxJson(
          {
            error:
              'La solicitud cambió. Actualiza la lista y vuelve a abrir la edición.',
          },
          409,
        );
      const original = await openAuxData<TransferRequestData>(
        row.encrypted_data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        'request:' + row.id,
      );
      let d: TransferRequestData;
      try {
        d = normalizeTransferRequest({
          ...original,
          tours: p.tours,
          tourNotes: p.tourNotes,
        });
      } catch (e) {
        return auxJson({ error: (e as Error).message }, 400);
      }
      const fingerprint = await digest(JSON.stringify(d));
      const duplicate = await db
        .prepare(
          'SELECT id FROM auxop_transfer_requests WHERE fingerprint=? AND id<>?',
        )
        .bind(fingerprint, row.id)
        .first<{ id: string }>();
      if (duplicate)
        return auxJson(
          {
            error:
              'Ya existe otra solicitud con estos mismos datos. Revisa las solicitudes guardadas.',
          },
          409,
        );
      const voucher = await db
        .prepare('SELECT * FROM auxop_transfer_vouchers WHERE id=?')
        .bind(row.id)
        .first<TransferVoucherRow>();
      if (!voucher || voucher.deleted_at)
        return auxJson(
          {
            error:
              'El voucher no está disponible. Actualiza y prepara el voucher antes de editar los tours.',
          },
          409,
        );
      const current = await openAuxData<TransferVoucher>(
        voucher.encrypted_data,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        'transfer:' + row.id,
      );
      // Older vouchers repeated the generated tours line in observations. Remove only that exact prefix.
      const legacy =
        'Tours: ' +
        (original.tours === 'SI' ? original.tourNotes : 'no incluidos');
      const notes =
        current.notes === legacy
          ? ''
          : current.notes.startsWith(legacy + '\n\n')
            ? current.notes.slice(legacy.length + 2)
            : current.notes;
      const updated = {
        ...current,
        tours: d.tours === 'SI',
        tourNotes: d.tourNotes,
        notes,
      };
      if (
        original.tours === d.tours &&
        original.tourNotes === d.tourNotes &&
        current.tours === updated.tours &&
        current.tourNotes === updated.tourNotes &&
        current.notes === notes
      )
        return auxJson({ record: await dto(row) });
      const nextState = row.state === 'pending' ? 'pending' : 'correction';
      const requestCipher = await sealAuxData(
          d,
          getRuntime().VAULT_ENCRYPTION_KEY!,
          'request:' + row.id,
        ),
        voucherCipher = await sealAuxData(
          updated,
          getRuntime().VAULT_ENCRYPTION_KEY!,
          'transfer:' + row.id,
        ),
        at = new Date().toISOString();
      // The request and its voucher change together. A stale editor or an active send cannot win this check.
      const results = await db.batch([
        db
          .prepare(
            'UPDATE auxop_transfer_requests SET encrypted_data=?,fingerprint=?,state=? WHERE id=? AND encrypted_data=? AND state=? AND EXISTS(SELECT 1 FROM auxop_transfer_vouchers WHERE id=? AND revision=? AND deleted_at IS NULL)',
          )
          .bind(
            requestCipher,
            fingerprint,
            nextState,
            row.id,
            row.encrypted_data,
            row.state,
            row.id,
            voucher.revision,
          ),
        db
          .prepare(
            'UPDATE auxop_transfer_vouchers SET encrypted_data=?,revision=revision+1,updated_at=?,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM auxop_transfer_requests WHERE id=? AND encrypted_data=?)',
          )
          .bind(
            voucherCipher,
            at,
            crypto.randomUUID(),
            row.id,
            voucher.revision,
            row.id,
            requestCipher,
          ),
        db
          .prepare(
            'INSERT INTO auxop_audit(id,entity,target,action,by,at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM auxop_transfer_requests WHERE id=? AND encrypted_data=?)',
          )
          .bind(
            crypto.randomUUID(),
            'transfer_request',
            row.id,
            'update_tours',
            a.email,
            at,
            row.id,
            requestCipher,
          ),
      ]);
      if (!results[0].meta.changes)
        return auxJson(
          {
            error:
              'La solicitud o el voucher cambiaron en otra sesión. Actualiza antes de guardar.',
          },
          409,
        );
      return auxJson({
        record: await dto({
          ...row,
          encrypted_data: requestCipher,
          fingerprint,
          state: nextState,
        }),
      });
    }
    if (p.action === 'voucher') {
      const failure = await prepareVoucher(row, a.email!);
      if (failure) return failure;
      return auxJson({ record: await dto(row) });
    }
    if (p.action === 'manual' || p.action === 'confirm') {
      const allowed =
        p.action === 'manual' ? ['pending'] : ['manual', 'sent', 'correction'];
      if (!allowed.includes(row.state))
        return auxJson(
          { error: 'Actualiza la solicitud antes de continuar.' },
          409,
        );
      if (p.confirmed !== true)
        return auxJson({ error: 'Confirma la gestión realizada.' }, 400);
      const failure = await prepareVoucher(row, a.email!);
      if (failure) return failure;
      const state = p.action === 'manual' ? 'manual' : 'confirmed',
        at = new Date().toISOString();
      const result = await db.batch([
        db
          .prepare(
            'UPDATE auxop_transfer_requests SET state=?,sent_at=COALESCE(sent_at,?) WHERE id=? AND state=? AND encrypted_data=?',
          )
          .bind(state, at, p.id, row.state, row.encrypted_data),
        db
          .prepare(
            'INSERT INTO auxop_audit(id,entity,target,action,by,at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM auxop_transfer_requests WHERE id=? AND state=? AND encrypted_data=?)',
          )
          .bind(
            crypto.randomUUID(),
            'transfer_request',
            p.id,
            p.action,
            a.email,
            at,
            p.id,
            state,
            row.encrypted_data,
          ),
      ]);
      if (!result[0].meta.changes)
        return auxJson(
          {
            error:
              'La solicitud cambió. Actualiza antes de registrar la gestión del operador.',
          },
          409,
        );
      return auxJson({ ok: true });
    }
    if (p.action !== 'send') return auxJson({ error: 'Acción inválida.' }, 400);
    if (!configured())
      return auxJson(
        {
          error:
            'Correo automático pendiente de conexión. Puedes abrir el correo preparado y enviarlo manualmente desde reservas@avioa.co.',
        },
        503,
      );
    if (row.state === 'sent' || row.state === 'confirmed') {
      const failure = await prepareVoucher(row, a.email!);
      return failure || auxJson({ ok: true });
    }
    if (row.state !== 'pending')
      return auxJson(
        {
          error:
            'Esta solicitud ya fue gestionada o tiene un envío por verificar. No se reenviará para evitar duplicados.',
        },
        409,
      );
    const record = await dto(row),
      d = record.data,
      op = operatorFor(d);
    if (!op.emails.length)
      return auxJson(
        { error: 'Este destino no tiene envío por correo configurado.' },
        400,
      );
    const failure = await prepareVoucher(row, a.email!);
    if (failure) return failure;
    const locked = await db
      .prepare(
        "UPDATE auxop_transfer_requests SET state='sending' WHERE id=? AND state='pending' AND encrypted_data=?",
      )
      .bind(p.id, row.encrypted_data)
      .run();
    if (!locked.meta.changes)
      return auxJson(
        {
          error:
            'Otra sesión está procesando o editando la solicitud. Actualiza antes de enviarla.',
        },
        409,
      );
    let response: Response, result: any;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: 'Bearer ' + settings().key,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'avioa-transfer-' + row.id,
        },
        body: JSON.stringify({
          from: 'aVioa Reservas <reservas@avioa.co>',
          to: op.emails,
          reply_to: 'reservas@avioa.co',
          subject: transferSubject(d),
          text: transferMessage(d),
          html: transferEmailHtml(d),
        }),
      });
      result = await response.json();
    } catch {
      await db
        .prepare(
          "UPDATE auxop_transfer_requests SET state='unknown' WHERE id=?",
        )
        .bind(p.id)
        .run();
      return auxJson(
        {
          error:
            'No se pudo confirmar el resultado. Revisa el servicio de correo antes de reenviar; podría haberse enviado.',
        },
        502,
      );
    }
    if (!response.ok || typeof result.id !== 'string') {
      const safeRejected = [400, 401, 403, 422, 429].includes(response.status);
      await db
        .prepare('UPDATE auxop_transfer_requests SET state=? WHERE id=?')
        .bind(safeRejected ? 'pending' : 'unknown', p.id)
        .run();
      return auxJson(
        {
          error: safeRejected
            ? 'El servicio de correo rechazó el envío. Revisa la conexión y el remitente.'
            : 'Resultado de envío por verificar. No reenvíes hasta comprobarlo.',
        },
        502,
      );
    }
    await db.batch([
      db
        .prepare(
          "UPDATE auxop_transfer_requests SET state='sent',provider_id=?,sent_at=? WHERE id=?",
        )
        .bind(result.id, new Date().toISOString(), p.id),
      db
        .prepare(
          'INSERT INTO auxop_audit(id,entity,target,action,by,at) VALUES(?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          'transfer_request',
          p.id,
          'email_accepted',
          a.email,
          new Date().toISOString(),
        ),
    ]);
    return auxJson({ ok: true });
  } catch {
    return auxJson(
      {
        error:
          'No se pudo completar la operación. Actualiza antes de intentar de nuevo.',
      },
      503,
    );
  }
}
