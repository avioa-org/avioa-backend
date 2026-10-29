import { getRuntime } from '../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  documentDto,
  sealAuxData,
  validAuxFields,
  auxAudit,
  type AuxDocumentRow,
  type AuxAttachment,
} from '../../domain/auxiliary';

type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, c: Context) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Documento inválido.' }, 400);
    const row = await getRuntime()
      .DB!.prepare(
        'SELECT * FROM auxop_documents WHERE id=? AND deleted_at IS NULL',
      )
      .bind(id)
      .first<AuxDocumentRow>();
    if (!row || (a.permissions.ownDocuments && row.created_by !== a.email))
      return auxJson({ error: 'Documento no encontrado.' }, 404);
    return auxJson({
      document: await documentDto(row, getRuntime().VAULT_ENCRYPTION_KEY!),
    });
  } catch {
    return auxJson({ error: 'No se pudo abrir el documento.' }, 503);
  }
}
export async function POST(r: Request, c: Context) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const { id } = await c.params,
      raw = await r.text();
    if (!auxUuid(id) || raw.length > 30000)
      return auxJson({ error: 'Datos inválidos o demasiado largos.' }, 400);
    const p = JSON.parse(raw);
    if (
      !validAuxFields(p.fields) ||
      !Number.isSafeInteger(p.revision) ||
      !auxUuid(p.requestId) ||
      typeof p.verified !== 'boolean' ||
      typeof p.reservationCode !== 'string' ||
      p.reservationCode.length > 200
    )
      return auxJson({ error: 'Revisa los datos del documento.' }, 400);
    if (
      p.verified &&
      (!p.fields.names.trim() || !p.fields.documentNumber.trim())
    )
      return auxJson(
        {
          error:
            'Para marcarlo revisado, completa el nombre y el número de documento.',
        },
        400,
      );
    const db = getRuntime().DB!,
      row = await db
        .prepare(
          'SELECT * FROM auxop_documents WHERE id=? AND deleted_at IS NULL',
        )
        .bind(id)
        .first<AuxDocumentRow>();
    if (!row || (a.permissions.ownDocuments && row.created_by !== a.email))
      return auxJson({ error: 'Documento no encontrado.' }, 404);
    const previous = await documentDto(row, getRuntime().VAULT_ENCRYPTION_KEY!);
    const cipher = await sealAuxData(
        {
          fields: p.fields,
          warnings: previous.warnings,
          passport: previous.passport,
        },
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
      ),
      at = new Date().toISOString();
    const updated = await db
      .prepare(
        'UPDATE auxop_documents SET encrypted_data=?,reservation_code=?,state=?,revision=revision+1,updated_by=?,updated_at=?,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL',
      )
      .bind(
        cipher,
        p.reservationCode.trim(),
        p.verified ? 'verified' : 'extracted',
        a.email,
        at,
        p.requestId,
        id,
        p.revision,
      )
      .run();
    if (!updated.meta.changes)
      return auxJson(
        {
          error:
            'El documento cambió en otra sesión. Actualiza antes de guardar.',
        },
        409,
      );
    await auxAudit(
      db,
      a.email!,
      'document',
      id,
      p.verified ? 'review' : 'edit',
    );
    const saved = await db
      .prepare('SELECT * FROM auxop_documents WHERE id=?')
      .bind(id)
      .first<AuxDocumentRow>();
    return auxJson({
      document: await documentDto(saved!, getRuntime().VAULT_ENCRYPTION_KEY!),
    });
  } catch {
    return auxJson(
      { error: 'No se pudieron guardar los datos revisados.' },
      503,
    );
  }
}
export async function DELETE(r: Request, c: Context) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Documento inválido.' }, 400);
    const db = getRuntime().DB!,
      row = await db
        .prepare('SELECT * FROM auxop_documents WHERE id=?')
        .bind(id)
        .first<AuxDocumentRow>();
    if (!row || (a.permissions.ownDocuments && row.created_by !== a.email))
      return auxJson({ error: 'Documento no encontrado.' }, 404);
    for (const item of JSON.parse(row.attachments) as AuxAttachment[])
      await getRuntime().BUCKET!.delete(item.key);
    const at = new Date().toISOString();
    await db
      .prepare(
        "UPDATE auxop_documents SET deleted_at=COALESCE(deleted_at,?),updated_by=?,updated_at=?,revision=revision+1,encrypted_data='',attachments='[]',reservation_code='' WHERE id=?",
      )
      .bind(at, a.email, at, id)
      .run();
    if (!row.deleted_at) await auxAudit(db, a.email!, 'document', id, 'delete');
    return auxJson({ ok: true });
  } catch {
    return auxJson(
      {
        error:
          'No se pudo completar la eliminación. Intenta de nuevo para liberar los archivos restantes.',
      },
      503,
    );
  }
}
