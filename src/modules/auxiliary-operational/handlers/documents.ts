import { getRuntime } from '../runtime';
import { PDFDocument } from 'pdf-lib';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  documentDto,
  emptyAuxFields,
  detectAuxMime,
  sealAuxFile,
  sealAuxData,
  auxAudit,
  type AuxAttachment,
  type AuxDocumentRow,
} from '../domain/auxiliary';

export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const p = new URL(r.url).searchParams,
      q = (p.get('q') || '').trim().slice(0, 200),
      page = Math.max(1, Math.min(10000, Number(p.get('page')) || 1)),
      db = getRuntime().DB!;
    const count = await db
      .prepare(
        `SELECT COUNT(*) n FROM auxop_documents WHERE deleted_at IS NULL AND (?='' OR created_by=?) AND instr(lower(reservation_code),lower(?))>0`,
      )
      .bind(
        a.permissions.ownDocuments ? a.email : '',
        a.permissions.ownDocuments ? a.email : '',
        q,
      )
      .first<{ n: number }>();
    const rows = (
      await db
        .prepare(
          `SELECT * FROM auxop_documents WHERE deleted_at IS NULL AND (?='' OR created_by=?) AND instr(lower(reservation_code),lower(?))>0 ORDER BY updated_at DESC,id LIMIT 25 OFFSET ?`,
        )
        .bind(
          a.permissions.ownDocuments ? a.email : '',
          a.permissions.ownDocuments ? a.email : '',
          q,
          (Math.floor(page) - 1) * 25,
        )
        .all<AuxDocumentRow>()
    ).results;
    return auxJson({
      documents: await Promise.all(
        rows.map((row) => documentDto(row, getRuntime().VAULT_ENCRYPTION_KEY!)),
      ),
      page: Math.floor(page),
      pages: Math.max(1, Math.ceil((count?.n || 0) / 25)),
      total: count?.n || 0,
    });
  } catch {
    return auxJson({ error: 'No se pudieron consultar los documentos.' }, 503);
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  const keys: string[] = [];
  try {
    if (
      !getRuntime().BUCKET ||
      !getRuntime().DB ||
      !getRuntime().VAULT_ENCRYPTION_KEY
    )
      return auxJson(
        { error: 'El almacenamiento de documentos no está disponible.' },
        503,
      );
    const length = Number(r.headers.get('content-length'));
    if (length > 18 * 1024 * 1024)
      return auxJson({ error: 'La carga supera el máximo permitido.' }, 413);
    const form = await r.formData(),
      id = form.get('requestId'),
      kind = form.get('kind'),
      reservationCode = String(form.get('reservationCode') || '').trim(),
      files = form.getAll('files');
    if (
      !auxUuid(id) ||
      !['passport', 'idcard'].includes(String(kind)) ||
      reservationCode.length > 200 ||
      files.length < 1 ||
      files.length > 10 ||
      files.some(
        (f) => !(f instanceof File) || f.size < 1 || f.size > 8 * 1024 * 1024,
      )
    )
      return auxJson(
        {
          error:
            'Selecciona hasta 10 archivos de hasta 8 MB cada uno: fotos JPG, PNG, WebP o PDF.',
        },
        400,
      );
    if (
      files.reduce((total, file) => total + (file as File).size, 0) >
      16 * 1024 * 1024
    )
      return auxJson(
        {
          error:
            'La selección supera 16 MB en total. Reduce el tamaño o transcribe menos archivos a la vez.',
        },
        413,
      );
    const attachments: AuxAttachment[] = [],
      raw: Uint8Array[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File,
        bytes = new Uint8Array(await file.arrayBuffer()),
        contentType = detectAuxMime(bytes);
      if (!contentType)
        return auxJson(
          { error: 'Formato no permitido. Usa JPG, PNG, WebP o PDF.' },
          415,
        );
      if (contentType === 'application/pdf') {
        try {
          const pdf = await PDFDocument.load(bytes);
          if (pdf.getPageCount() > 4)
            return auxJson(
              {
                error:
                  'Cada PDF puede tener hasta 4 páginas. Carga solo las páginas del documento.',
              },
              400,
            );
        } catch {
          return auxJson(
            {
              error:
                'No se pudo abrir el PDF. Usa un PDF sin contraseña o una foto legible.',
            },
            400,
          );
        }
      }
      raw.push(bytes);
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (v) => v.toString(16).padStart(2, '0'),
      ).join('');
      attachments.push({
        key: `auxiliary/documents/${id}/${i}.encrypted`,
        fileName:
          file.name.replace(/[\r\n\0\\/]/g, '_').slice(0, 160) || 'documento',
        contentType,
        size: file.size,
        hash,
      });
    }
    const db = getRuntime().DB!,
      existing = await db
        .prepare('SELECT * FROM auxop_documents WHERE id=?')
        .bind(id)
        .first<AuxDocumentRow>();
    if (existing) {
      const old = JSON.parse(existing.attachments) as AuxAttachment[];
      if (
        existing.deleted_at ||
        existing.created_by !== a.email ||
        existing.kind !== kind ||
        existing.reservation_code !== reservationCode ||
        old.length !== attachments.length ||
        old.some((f, i) => f.hash !== attachments[i].hash)
      )
        return auxJson(
          {
            error:
              'Esa carga corresponde a otros datos. Vuelve a seleccionar el archivo.',
          },
          409,
        );
      return auxJson({
        document: await documentDto(
          existing,
          getRuntime().VAULT_ENCRYPTION_KEY!,
        ),
        replayed: true,
      });
    }
    for (let i = 0; i < attachments.length; i++) {
      const entry = attachments[i];
      await getRuntime().BUCKET!.put(
        entry.key,
        await sealAuxFile(
          raw[i],
          getRuntime().VAULT_ENCRYPTION_KEY!,
          entry.key,
        ),
        { httpMetadata: { contentType: 'application/octet-stream' } },
      );
      keys.push(entry.key);
    }
    const at = new Date().toISOString(),
      encrypted = await sealAuxData(
        { fields: emptyAuxFields, warnings: [] },
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
      );
    await db
      .prepare(
        "INSERT INTO auxop_documents(id,kind,reservation_code,encrypted_data,attachments,state,revision,created_by,created_at,updated_by,updated_at,last_operation) VALUES(?,?,?,?,?,'uploaded',1,?,?,?,?,?)",
      )
      .bind(
        id,
        kind,
        reservationCode,
        encrypted,
        JSON.stringify(attachments),
        a.email,
        at,
        a.email,
        at,
        id,
      )
      .run();
    keys.length = 0;
    await auxAudit(db, a.email!, 'document', id, 'upload');
    const row = await db
      .prepare('SELECT * FROM auxop_documents WHERE id=?')
      .bind(id)
      .first<AuxDocumentRow>();
    return auxJson(
      { document: await documentDto(row!, getRuntime().VAULT_ENCRYPTION_KEY!) },
      201,
    );
  } catch {
    for (const key of keys)
      try {
        await getRuntime().BUCKET?.delete(key);
      } catch {
        /* Inaccessible encrypted orphan; do not log document data. */
      }
    return auxJson(
      {
        error:
          'No se pudo guardar el documento. Puedes reintentar la misma carga.',
      },
      503,
    );
  }
}
