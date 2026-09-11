/**
 * Genera el JSON que se le envía a POST /admin/vacations/bulk-migrate-historical
 *
 * Ejecución (VPS):
 *   npx ts-node prisma/seeds/generar-payload-migracion.ts
 *   # o compilado:
 *   node dist/prisma/seeds/generar-payload-migracion.js
 *
 * Uso alternativo con argumentos (descomentar bloque más abajo):
 *   npx ts-node generar-payload-migracion.ts \
 *     --export-portal export_portal_con_userid.json \
 *     --reconciliacion reconciliacion_vacaciones.csv \
 *     --fecha-corte 2026-09-09 \
 *     --out bulk-migrate-payload.json
 *
 * Port 1:1 del script original en Python. Mismo comportamiento, mismos
 * mensajes, mismo redondeo (banker's rounding como Python 3).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';

// ─────────────────────────────────────────────────────────────
// Configuración de rutas (mismo patrón que tus otros seeds)
// ─────────────────────────────────────────────────────────────

const EXPORT_PORTAL_PATH = path.join(
  __dirname,
  './data/export_portal_con_userid.json',
);
const RECONCILIACION_PATH = path.join(
  __dirname,
  './data/reconciliacion_vacaciones.csv',
);
const OUT_PATH = path.join(__dirname, './data/bulk-migrate-payload.json');

const LEADER_ID: string | null = null; // fallback opcional; null = no usar
const FECHA_CORTE: string | null = '2026-09-09'; // YYYY-MM-DD; null = ayer

// Alternativa con argv (descomentar si querés pasar por CLI):
//
// interface Args {
//   exportPortal: string;
//   reconciliacion: string;
//   leaderId: string | null;
//   fechaCorte: string | null;
//   out: string;
// }
//
// function parseArgs(argv: string[]): Args {
//   const partial: Partial<Args> = {
//     leaderId: null,
//     fechaCorte: null,
//     out: 'bulk-migrate-payload.json',
//   };
//   for (let i = 0; i < argv.length; i++) {
//     const a = argv[i];
//     const takeNext = (): string => {
//       i++;
//       if (i >= argv.length) throw new Error(`Falta valor para ${a}`);
//       return argv[i];
//     };
//     if (a === '--export-portal') partial.exportPortal = takeNext();
//     else if (a === '--reconciliacion') partial.reconciliacion = takeNext();
//     else if (a === '--leader-id') partial.leaderId = takeNext();
//     else if (a === '--fecha-corte') partial.fechaCorte = takeNext();
//     else if (a === '--out') partial.out = takeNext();
//     else if (a.startsWith('--export-portal='))
//       partial.exportPortal = a.slice('--export-portal='.length);
//     else if (a.startsWith('--reconciliacion='))
//       partial.reconciliacion = a.slice('--reconciliacion='.length);
//     else if (a.startsWith('--leader-id='))
//       partial.leaderId = a.slice('--leader-id='.length);
//     else if (a.startsWith('--fecha-corte='))
//       partial.fechaCorte = a.slice('--fecha-corte='.length);
//     else if (a.startsWith('--out='))
//       partial.out = a.slice('--out='.length);
//     else throw new Error(`Argumento desconocido: ${a}`);
//   }
//   if (!partial.exportPortal || !partial.reconciliacion) {
//     throw new Error(
//       'Faltan argumentos requeridos: --export-portal y --reconciliacion',
//     );
//   }
//   return partial as Args;
// }

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

interface PortalUser {
  user: {
    userId: string;
    name: string;
    leaderId?: string | null;
  };
}

interface Entry {
  userId: string;
  leaderId: string;
  businessDays: number;
  startDate: string;
  endDate: string;
  reason: string;
  newAdjustment: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function norm(s: string): string {
  let r = s.toUpperCase();
  // Equivalente a unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode()
  r = r.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  r = r.replace(/[^A-Z ]/g, ' ');
  return r.replace(/\s+/g, ' ').trim();
}

/**
 * Replica el round() de Python 3 (banker's rounding).
 * round(0.5)=0, round(1.5)=2, round(2.5)=2, round(3.5)=4.
 */
function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (frac === 0.5) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function main(): void {
  // Si querés usar argv, reemplazá estas 5 líneas por parseArgs(process.argv.slice(2))
  const exportPortalPath = EXPORT_PORTAL_PATH;
  const reconciliacionPath = RECONCILIACION_PATH;
  const leaderIdFallback = LEADER_ID;
  const fechaCorteArg = FECHA_CORTE;
  const outPath = OUT_PATH;

  if (!fs.existsSync(exportPortalPath)) {
    throw new Error(`No existe el export del portal: ${exportPortalPath}`);
  }
  if (!fs.existsSync(reconciliacionPath)) {
    throw new Error(
      `No existe el CSV de reconciliación: ${reconciliacionPath}`,
    );
  }

  const portal: PortalUser[] = JSON.parse(
    fs.readFileSync(exportPortalPath, 'utf-8'),
  );

  // Lookups por nombre normalizado
  const nameToUserid = new Map<string, string>();
  const nameToLeader = new Map<string, string | null>();
  for (const p of portal) {
    const key = norm(p.user.name);
    nameToUserid.set(key, p.user.userId);
    nameToLeader.set(key, p.user.leaderId ?? null);
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const fechaCorte = fechaCorteArg ?? formatDate(yesterday);

  const entries: Entry[] = [];
  const mediosDias: Array<[string, number, number]> = [];
  const sinUserid: string[] = [];
  const sinLeader: string[] = [];
  const conflictosNegativos: Array<
    [string, string | undefined, string | undefined]
  > = [];

  const csvContent = fs.readFileSync(reconciliacionPath, 'utf-8');
  const records: Record<string, string>[] = parseCsv(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  for (const row of records) {
    const nombre = row['nombre'];
    const nombreNorm = norm(nombre);

    const userid = nameToUserid.get(nombreNorm);
    if (!userid) {
      sinUserid.push(nombre);
      continue;
    }

    if (row['conflicto_negativo']) {
      conflictosNegativos.push([
        nombre,
        row['ACTUAL_taken'],
        row['NUEVO_taken'],
      ]);
      continue;
    }

    // Líder: primero del JSON, luego fallback global
    const leaderId = nameToLeader.get(nombreNorm) || leaderIdFallback;
    if (!leaderId) {
      sinLeader.push(nombre);
      continue;
    }

    const takenRaw = parseFloat(row['A_MIGRAR_como_historico'] || '0');
    const takenRounded = pythonRound(takenRaw);
    if (Math.abs(takenRaw - takenRounded) > 1e-9) {
      mediosDias.push([nombre, takenRaw, takenRounded]);
    }

    entries.push({
      userId: userid,
      leaderId,
      businessDays: takenRounded,
      startDate: fechaCorte,
      endDate: fechaCorte,
      reason: `Saldo historico validado por RRHH al ${fechaCorte}`,
      newAdjustment: 0,
    });
  }

  const payload = { dryRun: true, entries };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(
    `OK: ${entries.length} entradas escritas en ${outPath} (dryRun=true)`,
  );

  if (sinUserid.length) {
    console.log(
      `\nADVERTENCIA: ${sinUserid.length} personas del CSV no se encontraron en el export (revisa nombres):`,
    );
    for (const n of sinUserid) console.log(`  - ${n}`);
  }

  if (sinLeader.length) {
    console.log(
      `\nSIN LEADER (${sinLeader.length}): no tienen leaderId en el export ni se pasó --leader-id. Excluidas:`,
    );
    for (const n of sinLeader) console.log(`  - ${n}`);
  }

  if (mediosDias.length) {
    console.log(
      `\nADVERTENCIA: ${mediosDias.length} personas con días no enteros, se redondearon:`,
    );
    for (const [n, raw, rounded] of mediosDias) {
      console.log(`  - ${n}: ${raw} -> ${rounded}`);
    }
  }

  if (conflictosNegativos.length) {
    console.log(
      `\nEXCLUIDAS (${conflictosNegativos.length}): portal ya tiene MÁS días tomados que el validado:`,
    );
    for (const [n, actual, nuevo] of conflictosNegativos) {
      console.log(
        `  - ${n}: portal ya tiene ${actual} tomados, dato validado dice ${nuevo}`,
      );
    }
  }
}

main();
