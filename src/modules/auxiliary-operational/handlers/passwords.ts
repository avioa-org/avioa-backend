import { getRuntime } from '../runtime';
import { auxiliaryAccess, auxJson, auxUuid } from '../domain/auxiliary';
import {
  listPasswords,
  readPassword,
  changePassword,
  importAuxiliaryPasswords,
} from '../domain/auxiliary-passwords';

export async function GET(r: Request) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    if (!/^[a-f0-9]{64}$/i.test(getRuntime().VAULT_ENCRYPTION_KEY || ''))
      return auxJson(
        { error: 'El almacenamiento seguro no está disponible.' },
        503,
      );
    const id = new URL(r.url).searchParams.get('id');
    if (id) {
      if (!auxUuid(id)) return auxJson({ error: 'Registro inválido.' }, 400);
      const entry = await readPassword(
        getRuntime().DB!,
        getRuntime().VAULT_ENCRYPTION_KEY!,
        id,
      );
      return entry
        ? auxJson({ entry })
        : auxJson({ error: 'Registro no encontrado.' }, 404);
    }
    return auxJson({
      entries: await listPasswords(
        getRuntime().DB!,
        getRuntime().VAULT_ENCRYPTION_KEY!,
      ),
    });
  } catch {
    return auxJson({ error: 'No se pudieron cargar las contraseñas.' }, 503);
  }
}
export async function POST(r: Request) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    if (!/^[a-f0-9]{64}$/i.test(getRuntime().VAULT_ENCRYPTION_KEY || ''))
      return auxJson(
        { error: 'El almacenamiento seguro no está disponible.' },
        503,
      );
    const raw = await r.text();
    if (raw.length > 1500000)
      return auxJson({ error: 'Solicitud demasiado grande.' }, 413);
    let p: Record<string, unknown>;
    try {
      p = JSON.parse(raw);
      if (!p || typeof p !== 'object' || Array.isArray(p))
        return auxJson({ error: 'Datos inválidos.' }, 400);
    } catch {
      return auxJson({ error: 'Datos inválidos.' }, 400);
    }
    const result =
      p.action === 'import'
        ? await importAuxiliaryPasswords(
            getRuntime().DB!,
            getRuntime().VAULT_ENCRYPTION_KEY!,
            a.email!,
            p.entries,
          )
        : await changePassword(
            getRuntime().DB!,
            getRuntime().VAULT_ENCRYPTION_KEY!,
            a.email!,
            p,
          );
    return auxJson(result, result.status);
  } catch {
    return auxJson({ error: 'No se pudo guardar el cambio.' }, 503);
  }
}
