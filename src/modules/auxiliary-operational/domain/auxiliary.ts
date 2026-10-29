import { getRuntime } from '../runtime';
import type { SqlDatabase } from '../postgres.repository';
import type { PassportInfo } from './passport-validity';
import { openVault, sealVault } from './vault-crypto';
export * from './auxiliary-data';
import type {
  AuxFields,
  AuxDocument,
  AuxDocumentRow,
  AuxAttachment,
  AuxPassenger,
} from './auxiliary-data';
import { auxFields } from './auxiliary-data';
export const auxUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const auxJson = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function auxiliaryAccess(_request: Request, write = false) {
  const runtime = getRuntime();
  if (write && !runtime.canWrite)
    return {
      error: auxJson(
        { error: 'No tienes permiso para modificar Auxiliares.' },
        403,
      ),
    };
  return {
    email: runtime.actor,
    permissions: {
      view: true,
      edit: runtime.canWrite,
      name: runtime.name,
      ownDocuments: false,
    },
  };
}
export function validAuxFields(value: unknown): value is AuxFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  return (
    Object.keys(auxFields).every(
      (k) => typeof d[k] === 'string' && d[k].length <= 200,
    ) && Object.keys(d).every((k) => Object.hasOwn(auxFields, k))
  );
}
export async function sealAuxData(value: unknown, secret: string, id: string) {
  return sealVault(
    {
      name: 'Auxiliares operativos',
      username: id,
      password: JSON.stringify(value),
      link: '',
    },
    secret,
    'aux:' + id,
  );
}
export async function openAuxData<T>(
  cipher: string,
  secret: string,
  id: string,
): Promise<T> {
  return JSON.parse(
    (await openVault(cipher, secret, 'aux:' + id)).password,
  ) as T;
}
export async function documentDto(
  row: AuxDocumentRow,
  secret: string,
): Promise<AuxDocument> {
  const data = await openAuxData<{
    fields: AuxFields;
    warnings: string[];
    passport?: PassportInfo;
    passengers?: AuxPassenger[];
  }>(row.encrypted_data, secret, row.id);
  return {
    id: row.id,
    kind: row.kind,
    reservationCode: row.reservation_code,
    fields: Object.fromEntries(
      Object.keys(auxFields).map((k) => [
        k,
        data.fields[k as keyof AuxFields] || '',
      ]),
    ) as AuxFields,
    warnings: data.warnings || [],
    passport: data.passport,
    passengers: data.passengers,
    attachments: (JSON.parse(row.attachments) as AuxAttachment[]).map(
      ({ fileName, contentType, size }) => ({ fileName, contentType, size }),
    ),
    state: row.state,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function fileKey(secret: string) {
  if (!/^[0-9a-f]{64}$/i.test(secret))
    throw Error('Falta configurar el cifrado de documentos.');
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(secret.match(/../g)!, (x) => parseInt(x, 16)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}
const bytes = (v: Uint8Array) =>
  v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer;
export async function sealAuxFile(
  plain: Uint8Array,
  secret: string,
  key: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(key) },
        await fileKey(secret),
        bytes(plain),
      ),
    );
  const result = new Uint8Array(13 + cipher.length);
  result[0] = 1;
  result.set(iv, 1);
  result.set(cipher, 13);
  return result;
}
export async function openAuxFile(
  cipher: Uint8Array,
  secret: string,
  key: string,
) {
  if (cipher[0] !== 1 || cipher.length < 30)
    throw Error('Documento cifrado inválido.');
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes(cipher.slice(1, 13)),
        additionalData: new TextEncoder().encode(key),
      },
      await fileKey(secret),
      bytes(cipher.slice(13)),
    ),
  );
}
export function detectAuxMime(d: Uint8Array) {
  if (d[0] === 255 && d[1] === 216 && d[2] === 255) return 'image/jpeg';
  if (d[0] === 137 && d[1] === 80 && d[2] === 78 && d[3] === 71)
    return 'image/png';
  const s = new TextDecoder().decode(d.slice(0, 16));
  if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image/webp';
  if (s.startsWith('%PDF-')) return 'application/pdf';
  return null;
}
export async function auxAudit(
  db: SqlDatabase,
  actor: string,
  entity: string,
  target: string,
  action: string,
) {
  await db
    .prepare(
      'INSERT INTO auxop_audit(id,entity,target,action,by,at) VALUES(?,?,?,?,?,?)',
    )
    .bind(
      crypto.randomUUID(),
      entity,
      target,
      action,
      actor,
      new Date().toISOString(),
    )
    .run();
}
