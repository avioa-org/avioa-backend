import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

// const EXPORT_PORTAL_PATH = path.join(
//   __dirname,
//   './data/export_portal_con_userid.json',
// );
// const RECONCILIACION_PATH = path.join(
//   __dirname,
//   './data/reconciliacion_vacaciones.csv',
// );

// const LEAVE_REQUESTS_PATH = path.join(__dirname, './data/leave_requests.csv');

// const OUT_PATH = path.join(__dirname, './data/bulk-migrate-payload.json');

// const EXPORT_PORTAL_PATH =
//   process.argv[2] ?? '/tmp/export_portal_con_userid.json';
// const RECONCILIACION_PATH =
//   process.argv[3] ?? '/tmp/reconciliacion_vacaciones.csv';
// const OUT_PATH = process.argv[4] ?? '/tmp/bulk-migrate-payload.json';
// const LEAVE_REQUESTS_PATH = process.argv[5] ?? '/tmp/leave_requests.csv';

const EXPORT_PORTAL_PATH =
  './src/infrastructure/scripts/data/export_portal_con_userid.json';
const RECONCILIACION_PATH =
  './src/infrastructure/scripts/data/reconciliacion_vacaciones.csv';
const LEAVE_REQUESTS_PATH =
  './src/infrastructure/scripts/data/leave_requests.csv';
const OUT_PATH = './src/infrastructure/scripts/data/bulk-migrate-payload.json';

const FECHA_CORTE = '2026-09-17';
const LOTE = 'lote-3-programados-rrhh';
const DRY_RUN = true;

function pyRound(x: number): number {
  const f = Math.floor(x);
  const fr = x - f;
  if (Math.abs(fr - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

function norm(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  // 1) Estado actual del portal desde leave_requests.csv
  const lrRows: any[] = parse(fs.readFileSync(LEAVE_REQUESTS_PATH, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  });

  const portalByUser = new Map<string, { taken: number; pending: number }>();
  for (const r of lrRows) {
    if (r.type !== 'VACACIONES') continue;
    const e = portalByUser.get(r.user_id) ?? { taken: 0, pending: 0 };
    const days = parseFloat(r.business_days) || 0;
    if (r.status === 'APPROVED') e.taken += days;
    if (r.status === 'PENDING') e.pending += days;
    portalByUser.set(r.user_id, e);
  }

  // 2) Mapa nombre → userId + leaderId desde el JSON
  const portal: any[] = JSON.parse(
    fs.readFileSync(EXPORT_PORTAL_PATH, 'utf-8'),
  );
  const nameToUser = new Map<
    string,
    { userId: string; leaderId: string | null }
  >();
  for (const p of portal) {
    nameToUser.set(norm(p.user.name), {
      userId: p.user.userId,
      leaderId: p.user.leaderId ?? null,
    });
  }

  // 3) Targets del Excel
  const recRows: any[] = parse(fs.readFileSync(RECONCILIACION_PATH, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  });

  const takenEntries: any[] = [];
  const pendingEntries: any[] = [];
  const skipped: string[] = [];
  const reductions: string[] = [];
  const sinUserid: string[] = [];
  const sinLeader: string[] = [];

  for (const row of recRows) {
    const nombre = row['nombre'];
    const target = nameToUser.get(norm(nombre));
    if (!target) {
      sinUserid.push(nombre);
      continue;
    }

    if (row['accion'] === 'SKIP') {
      skipped.push(nombre);
      continue;
    }
    if (row['accion'] === 'REDUCIR') {
      reductions.push(nombre);
      continue;
    }
    if (!target.leaderId) {
      sinLeader.push(nombre);
      continue;
    }

    const portalBal = portalByUser.get(target.userId) ?? {
      taken: 0,
      pending: 0,
    };
    const excelTaken = parseFloat(row['NUEVO_taken'] || '0');
    const excelPending = parseFloat(row['NUEVO_pending'] || '0');
    const pendingApproved = parseFloat(row['pending_ya_approved'] || '0');

    const deltaTaken = pyRound(excelTaken + pendingApproved - portalBal.taken);
    const deltaPending = pyRound(
      excelPending - pendingApproved - portalBal.pending,
    );

    if (deltaTaken > 0) {
      takenEntries.push({
        userId: target.userId,
        leaderId: target.leaderId,
        businessDays: deltaTaken,
        startDate: FECHA_CORTE,
        endDate: FECHA_CORTE,
        reason: `Ajuste tomados al ${FECHA_CORTE} [${LOTE}]`,
        status: 'APPROVED',
        newAdjustment: 0,
      });
    }

    if (deltaPending > 0) {
      pendingEntries.push({
        userId: target.userId,
        leaderId: target.leaderId,
        businessDays: deltaPending,
        startDate: FECHA_CORTE,
        endDate: FECHA_CORTE,
        reason: `Programados RRHH al ${FECHA_CORTE} [${LOTE}]`,
        status: 'PENDING',
        newAdjustment: 0,
      });
    }
  }

  const payload = {
    dryRun: DRY_RUN,
    taken: takenEntries,
    pending: pendingEntries,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('══════════════════════════════════════════════════');
  console.log(`  MIGRACIÓN ${LOTE}`);
  console.log('══════════════════════════════════════════════════');
  console.log(
    `  APPROVED : ${takenEntries.length} (${takenEntries.reduce((a, e) => a + e.businessDays, 0)} días)`,
  );
  console.log(
    `  PENDING  : ${pendingEntries.length} (${pendingEntries.reduce((a, e) => a + e.businessDays, 0)} días)`,
  );
  console.log(`  REDUCIR  : ${reductions.join(', ') || '—'}`);
  console.log(`  SKIP     : ${skipped.join(', ') || '—'}`);
  console.log(`  Sin match: ${sinUserid.length}`);
  console.log(`  Sin líder: ${sinLeader.length}`);
  console.log('══════════════════════════════════════════════════');
}

main();
