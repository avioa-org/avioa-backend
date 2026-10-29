import type { SqlDatabase, SqlStatement } from '../postgres.repository';
import { MAX_VAULT_IMPORT, vaultIdentity } from './vault-import';
import {
  openVault,
  sealVault,
  validVaultData,
  type VaultData,
} from './vault-crypto';
export type PasswordEntry = VaultData & {
  id: string;
  revision: number;
  updatedAt: string;
};
type Row = {
  id: string;
  encrypted: string;
  revision: number;
  updated_at: string;
};
const scope = (id: string) => `auxiliary-password:${id}`;
export async function listPasswords(db: SqlDatabase, secret: string) {
  const rows = await db
    .prepare(
      'SELECT id,encrypted,revision,updated_at FROM auxop_passwords ORDER BY updated_at DESC',
    )
    .all<Row>();
  return Promise.all(
    rows.results.map(async (row) => {
      const { password: _, ...data } = await openVault(
        row.encrypted,
        secret,
        scope(row.id),
      );
      return {
        ...data,
        id: row.id,
        revision: row.revision,
        updatedAt: row.updated_at,
      };
    }),
  );
}
export async function readPassword(
  db: SqlDatabase,
  secret: string,
  id: string,
): Promise<PasswordEntry | null> {
  const row = await db
    .prepare(
      'SELECT id,encrypted,revision,updated_at FROM auxop_passwords WHERE id=?',
    )
    .bind(id)
    .first<Row>();
  return row
    ? {
        ...(await openVault(row.encrypted, secret, scope(id))),
        id,
        revision: row.revision,
        updatedAt: row.updated_at,
      }
    : null;
}
export async function changePassword(
  db: SqlDatabase,
  secret: string,
  actor: string,
  p: Record<string, unknown>,
) {
  const action = p.action;
  if (!['create', 'update', 'delete'].includes(String(action)))
    return { status: 400, error: 'Acción inválida.' };
  const id = action === 'create' ? crypto.randomUUID() : p.id;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    return { status: 400, error: 'Registro inválido.' };
  if (
    action !== 'create' &&
    (!Number.isSafeInteger(p.revision) || Number(p.revision) < 1)
  )
    return { status: 400, error: 'Versión inválida.' };
  const now = new Date().toISOString();
  let statement: SqlStatement;
  if (action === 'delete')
    statement = db
      .prepare('DELETE FROM auxop_passwords WHERE id=? AND revision=?')
      .bind(id, p.revision);
  else {
    const data = {
      name: p.name,
      username: p.username,
      password: p.password,
      link: p.link,
    } as VaultData;
    if (!validVaultData(data))
      return {
        status: 400,
        error:
          'Completa nombre, usuario y contraseña. El enlace debe ser http o https.',
      };
    const encrypted = await sealVault(
      {
        ...data,
        name: data.name.trim(),
        username: data.username.trim(),
        link: data.link.trim(),
      },
      secret,
      scope(id),
    );
    statement =
      action === 'create'
        ? db
            .prepare(
              'INSERT INTO auxop_passwords (id,encrypted,revision,updated_at,updated_by) VALUES (?,?,1,?,?)',
            )
            .bind(id, encrypted, now, actor)
        : db
            .prepare(
              'UPDATE auxop_passwords SET encrypted=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?',
            )
            .bind(encrypted, now, actor, id, p.revision);
  }
  const results = await db.batch([
    statement,
    db
      .prepare(
        "INSERT INTO auxop_audit (id,entity,target,action,by,at) SELECT ?,'password',?,?,?,? WHERE changes()>0",
      )
      .bind(crypto.randomUUID(), id, action, actor, now),
  ]);
  if (!results[0].meta.changes)
    return {
      status: 409,
      error:
        'Este registro cambió o fue eliminado. Actualiza la lista e inténtalo de nuevo.',
    };
  return { status: 200, id };
}

export async function importAuxiliaryPasswords(
  db: SqlDatabase,
  secret: string,
  actor: string,
  rows: unknown,
) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > MAX_VAULT_IMPORT ||
    rows.some((row) => !row || !validVaultData(row))
  )
    return {
      status: 400,
      error: 'Revisa el archivo: máximo 200 accesos válidos.',
    };
  const existing = await listPasswords(db, secret),
    seen = new Set(existing.map(vaultIdentity));
  const seed = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(secret.match(/../g) || [], (v) => parseInt(v, 16)),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('avioa-auxiliary-password-import-v1'),
    },
    seed,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign'],
  );
  const statements: SqlStatement[] = [],
    now = new Date().toISOString();
  let skipped = 0;
  for (const data of rows as VaultData[]) {
    const identity = vaultIdentity(data);
    if (seen.has(identity)) {
      skipped++;
      continue;
    }
    seen.add(identity);
    const digest = new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(identity),
        ),
      ),
      hex = Array.from(digest.slice(0, 16), (v) =>
        v.toString(16).padStart(2, '0'),
      ).join('');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const encrypted = await sealVault(
      {
        ...data,
        name: data.name.trim(),
        username: data.username.trim(),
        link: data.link.trim(),
      },
      secret,
      scope(id),
    );
    statements.push(
      db
        .prepare(
          'INSERT INTO auxop_passwords (id,encrypted,revision,updated_at,updated_by) VALUES (?,?,1,?,?) ON CONFLICT(id) DO NOTHING',
        )
        .bind(id, encrypted, now, actor),
      db
        .prepare(
          "INSERT INTO auxop_audit (id,entity,target,action,by,at) SELECT ?,'password',?,'import',?,? WHERE changes()>0",
        )
        .bind(crypto.randomUUID(), id, actor, now),
    );
  }
  const results = statements.length ? await db.batch(statements) : [];
  const imported = results.reduce(
    (sum, r, i) => sum + (i % 2 === 0 ? Number(r.meta.changes) : 0),
    0,
  );
  return {
    status: 200,
    imported,
    skipped: skipped + statements.length / 2 - imported,
  };
}
