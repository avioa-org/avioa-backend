import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxFile,
  type AuxDocumentRow,
  type AuxAttachment,
} from '../../../domain/auxiliary';

export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const { id } = await c.params,
      index = Number(new URL(r.url).searchParams.get('index') || 0);
    if (!auxUuid(id) || !Number.isSafeInteger(index) || index < 0 || index > 9)
      return auxJson({ error: 'Archivo inválido.' }, 400);
    const row = await getRuntime()
        .DB!.prepare(
          'SELECT * FROM auxop_documents WHERE id=? AND deleted_at IS NULL',
        )
        .bind(id)
        .first<AuxDocumentRow>(),
      file = row && (JSON.parse(row.attachments) as AuxAttachment[])[index];
    if (!file || (a.permissions.ownDocuments && row?.created_by !== a.email))
      return auxJson({ error: 'Archivo no encontrado.' }, 404);
    const object = await getRuntime().BUCKET!.get(file.key);
    if (!object) return auxJson({ error: 'Archivo no disponible.' }, 404);
    const plain = await openAuxFile(
      new Uint8Array(await object.arrayBuffer()),
      getRuntime().VAULT_ENCRYPTION_KEY!,
      file.key,
    );
    return new Response(plain.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `${file.contentType === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return auxJson({ error: 'No se pudo abrir el archivo.' }, 503);
  }
}
