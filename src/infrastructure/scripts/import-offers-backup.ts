import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { PrismaClient } from 'generated/prisma/client'; // ← cliente estándar, no ../generated
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from 'src/config/env.config';

const file = process.argv[2];
if (!file || !envs.DATABASE_URL)
  throw new Error(
    'Uso: DATABASE_URL configurada + npx tsx scripts/import-offers-backup.ts archivo.ndjson',
  );
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
async function scan(consume?: (record: any) => Promise<void>) {
  let manifest: any,
    complete: any,
    state = 0,
    roles = 0,
    history = 0,
    lines = 0;
  const revisions = new Set<number>();
  const roleIds = new Set<string>();
  const hashes: string[] = [];
  const reader = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    if (!line.trim()) continue;
    if (line.length > 64_000_000 || ++lines > 100000)
      throw new Error('Respaldo fuera de límites.');
    const record = JSON.parse(line);
    if (complete) throw new Error('Hay datos después del cierre del respaldo.');
    if (record.kind === 'manifest') {
      if (
        manifest ||
        lines !== 1 ||
        record.format !== 'avioa-offers-migration-v1' ||
        record.projectId !== 'appgprj_6af3930fbe6481919226e5d7e811f4cd' ||
        !Number.isInteger(record.revision) ||
        record.revision < 1
      )
        throw new Error('Origen o formato de respaldo inválido.');
      manifest = record;
    } else if (record.kind === 'complete') complete = record;
    else {
      if (
        !manifest ||
        !['state', 'role', 'history'].includes(record.kind) ||
        hash(JSON.stringify(record.row)) !== record.sha256
      )
        throw new Error('Registro incompleto o alterado.');
      const row = record.row;
      if (record.kind === 'state') {
        if (++state !== 1 || row.id !== 1 || row.revision !== manifest.revision)
          throw new Error('Estado inválido.');
        const payload = JSON.parse(row.payload);
        if (
          !Array.isArray(payload.offers) ||
          new Set(payload.offers.map((o: any) => o.id)).size !==
            payload.offers.length
        )
          throw new Error('Ofertas inválidas.');
      } else if (record.kind === 'history') {
        if (
          !Number.isInteger(row.revision) ||
          row.revision < 1 ||
          row.revision > manifest.revision ||
          revisions.has(row.revision)
        )
          throw new Error('Revisión inválida o duplicada.');
        JSON.parse(row.payload);
        revisions.add(row.revision);
        history++;
      } else {
        if (typeof row.user_id !== 'string' || roleIds.has(row.user_id))
          throw new Error('Rol de origen duplicado.');
        roleIds.add(row.user_id);
        roles++;
      }
      hashes.push(record.sha256);
      if (consume) await consume(record);
    }
  }
  if (
    !manifest ||
    !complete ||
    state !== 1 ||
    complete.revision !== manifest.revision ||
    history !== manifest.expectedHistory ||
    roles !== manifest.expectedRoles ||
    history !== complete.history ||
    roles !== complete.roles ||
    hash(hashes.join('\n')) !== complete.sha256
  )
    throw new Error(
      'El respaldo está incompleto o no coincide con sus conteos. No se importa.',
    );
  return { revision: manifest.revision, history, roles };
}
async function main() {
  const result = await scan();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: envs.DATABASE_URL || process.env.DATABASE_URL!,
    }),
  });
  try {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(894612)',
        );
        if (
          (await transaction.offersWorkspaceState.count()) ||
          (await transaction.offersAuditHistory.count()) ||
          (await transaction.offersLegacyRole.count())
        )
          throw new Error(
            'El destino ya contiene datos. No se reemplaza ni se combina automáticamente.',
          );
        await scan(async ({ kind, row }) => {
          if (kind === 'state')
            await transaction.offersWorkspaceState.create({
              data: {
                id: 1,
                revision: row.revision,
                payload: row.payload,
                updatedAt: row.updated_at,
              },
            });
          if (kind === 'history')
            await transaction.offersAuditHistory.create({
              data: {
                revision: row.revision,
                actor: row.actor,
                actorId: row.actor_id as string,
                action: row.action,
                createdAt: row.created_at,
                payload: row.payload,
                summary: row.summary,
              },
            });
          if (kind === 'role')
            await transaction.offersLegacyRole.create({
              data: { userId: row.user_id, role: row.role },
            });
        });
      },
      { timeout: 600000 },
    );
    console.log(
      'Importación completa verificada:',
      result,
      'Los roles Sites se conservan como procedencia; los permisos se asignan en el portal.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
