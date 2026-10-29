import { getRuntime } from '../runtime';
import { auxiliaryAccess, auxJson, auxUuid } from '../domain/auxiliary';
import { validQuick, type QuickReply } from '../domain/auxiliary-quick-import';

export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const data = await getRuntime()
      .DB!.prepare(
        'SELECT id,title,category,body,html,revision FROM auxop_quick_replies ORDER BY category,title',
      )
      .all();
    return auxJson({ entries: data.results });
  } catch {
    return auxJson(
      { error: 'No se pudieron cargar las respuestas rápidas.' },
      503,
    );
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const raw = await r.text();
    if (raw.length > 2000000)
      return auxJson({ error: 'Archivo demasiado grande.' }, 413);
    const p = JSON.parse(raw),
      db = getRuntime().DB!,
      at = new Date().toISOString();
    if (p.action === 'import') {
      if (
        !Array.isArray(p.entries) ||
        !p.entries.length ||
        p.entries.length > 300 ||
        !p.entries.every(validQuick)
      )
        return auxJson(
          {
            error:
              'Revisa los textos: máximo 300 respuestas, título y respuesta obligatorios.',
          },
          400,
        );
      const statements = await Promise.all(
        (p.entries as QuickReply[]).map(async (e) => {
          const bytes = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(
                JSON.stringify([e.title, e.category, e.body, e.html]),
              ),
            ),
            key = Array.from(new Uint8Array(bytes), (x) =>
              x.toString(16).padStart(2, '0'),
            ).join('');
          return db
            .prepare(
              'INSERT INTO auxop_quick_replies(id,title,category,body,html,import_key,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?,1,?,?) ON CONFLICT(import_key) DO NOTHING',
            )
            .bind(
              crypto.randomUUID(),
              e.title,
              e.category,
              e.body,
              e.html,
              key,
              a.email!,
              at,
            );
        }),
      );
      const result = await db.batch(statements),
        added = result.reduce((n, x) => n + (x.meta.changes || 0), 0);
      return auxJson({ added, skipped: p.entries.length - added });
    }
    if (!auxUuid(p.id) || !Number.isSafeInteger(p.revision) || p.revision < 1)
      return auxJson({ error: 'Registro inválido.' }, 400);
    if (p.action === 'delete') {
      const result = await db
        .prepare('DELETE FROM auxop_quick_replies WHERE id=? AND revision=?')
        .bind(p.id, p.revision)
        .run();
      return result.meta.changes
        ? auxJson({ ok: true })
        : auxJson(
            { error: 'La respuesta cambió. Actualiza y vuelve a intentarlo.' },
            409,
          );
    }
    if (p.action === 'edit' && validQuick(p.entry)) {
      const e = p.entry;
      const result = await db
        .prepare(
          'UPDATE auxop_quick_replies SET title=?,category=?,body=?,html=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=?',
        )
        .bind(
          e.title,
          e.category,
          e.body,
          e.html,
          a.email!,
          at,
          p.id,
          p.revision,
        )
        .run();
      return result.meta.changes
        ? auxJson({ ok: true })
        : auxJson(
            { error: 'La respuesta cambió. Actualiza y vuelve a intentarlo.' },
            409,
          );
    }
    return auxJson({ error: 'Acción inválida.' }, 400);
  } catch {
    return auxJson(
      { error: 'No se pudo guardar. Revisa el archivo e intenta de nuevo.' },
      400,
    );
  }
}
