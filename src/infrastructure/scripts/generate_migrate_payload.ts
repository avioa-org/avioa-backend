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

const LEAVE_REQUESTS_PATH = path.join(__dirname, './data/leave_requests.csv');

const OUT_PATH = path.join(__dirname, './data/bulk-migrate-payload.json');

// const EXPORT_PORTAL_PATH =
//   process.argv[2] ?? '/tmp/export_portal_con_userid.json';
// const RECONCILIACION_PATH =
//   process.argv[3] ?? '/tmp/reconciliacion_vacaciones.csv';
// const OUT_PATH = process.argv[4] ?? '/tmp/bulk-migrate-payload.json';
// const LEAVE_REQUESTS_PATH = process.argv[5] ?? '/tmp/leave_requests.csv';

const LEADER_ID: string | null = null; // fallback; null = usar el del JSON
const FECHA_CORTE = '2026-09-10'; // alineado al Excel 17-09-2026
const LOTE = 'lote-2'; // identifica esta corrida
const MODO_DELTA = true; // opción C: NUEVO_taken - taken_actual
const SOLO_DELTA_POSITIVO = true; // append no puede restar
const DRY_RUN = true; // cambia a false para migrar de verdad

// ─────────────────────────────────────────────────────────────
// Alias: nombre del Excel → nombre en el portal
// ─────────────────────────────────────────────────────────────
const ALIAS: Record<string, string> = {
  'NATALIA OCAMPO': 'NATALIA MARIA OCAMPO HERRERA',
  'KAROL BEJARANO': 'KAROL VIVIANA BEJARANO BOLIVAR',
  'VANESSA CASTRO': 'LIZETH VANESA CASTRO VELASQUEZ',
  'YESIKA ZULUAGA': 'YESSIKA MARSELA ZULUAGA MARTINEZ',
  'CATHERINE ARISTIZABAL': 'CATHERINE ARISTIZABAL MARIN',
  'YULIANA GIRALDO': 'YULIANA MARCELA GIRALDO',
  'MANUELA GIRALDO': 'MANUELA GIRALDO GARCIA',
  'JUAN DIEGO CUARTAS': 'JUAN DIEGO CUARTAS ZULUAGA',
  'ROSA VANEGAS': 'ROSA MARIA VANEGAS SANCHEZ',
  'DAHIANA VASQUEZ': 'DAHIANA VASQUEZ MUÑOZ',
  'Nicol Dayan Gómez': 'NICOL DAYAN GÓMEZ MUÑOZ',
  'SALOME ARISTIZABAL': 'SALOME ARISTIZABAL CASTAÑO',
  'NARLY LONDOÑO': 'NARLYN YULIETH LONDOÑO TORRES',
  'PAOLA JARAMILLO': 'PAOLA ANDREA JARAMILLO MARIN',
  'JESSEIN CANO': 'JESSEIN CANO DUQUE',
  KERLY: 'Kerly Alejandra Becerra Puerto',
  'CAROL JAIMES': 'CAROL LISETTE JAIMES BERNAL',
  'NATALIA ARISTIZABAL': 'NATALIA PAOLA ARISTIZABAL RAMIREZ',
  'JUAN FELIPE RAMIREZ': 'JUAN FELIPE RAMIREZ SIERRA',
  'JOHANA LOPEZ': 'JOHANNA LOPEZ CORREDOR',
  'CHRISTIAN CASTAÑO': 'CHRISTIAN CAMILO CASTAÑO RAMIREZ',
  'CAROLINA ORTEGA': 'CAROLINA ORTEGA GÓMEZ',
  'Tomas Munera Hurtado': 'TOMAS MÚNERA HURTADO',
  'Maria Elisa Muñoz Torres': 'MARIA ELISA MUÑOZ TORRES',
  'Maria Fernanda Cordoba Cañas': 'MARIA FERNANDA CORDOBA CAÑAS',
  'Juan Camilo Agudelo Giraldo': 'JUAN CAMILO AGUDELO GIRALDO',
  'Johan Steven Grajales Urrea': 'JOHAN STEVEN GRAJALES URREA',
  'LEIDY ARISTIZABAL': 'LEIDY JOHANA ARISTIZABAL ALZATE',
  'STEFANY GONZALEZ SUAREZ': 'STEFANY GONZALEZ SUAREZ',
  'Denis Natalia Gómez': 'DENIS NATALIA GÓMEZ MONTOYA',
  'ANA ISABEL ORTIZ': 'ANA ISABEL ORTIZ BOTERO',
  'ALEJANDRO NARVAEZ': 'ALEJANDRO NARVAEZ VARGAS',
  'LORENA CARDONA OSORNO': 'LORENA CARDONA OSORNO',
  'Maria Camila Zuluaga Duque': 'MARIA CAMILA ZULUAGA DUQUE',
  'Juan Manuel Salazar Marín': 'JUAN MANUEL SALAZAR MARIN',
  'Karina Julieth Palmet Parra': 'KARINA JULIETH PALMET PARRA',
  'Sigifredo Castaño Ceballos': 'SIGIFREDO CASTAÑO CEBALLOS',
  'Juan Esteban Ramos Valderrama': 'JUAN ESTEBAN RAMOS VALDERRAMA',
  'Jeiny Lorena Valencia Betancur': 'JEINY LORENA VALENCIA BETANCUR',
  'Sebastian Monsalve Castañeda': 'SEBASTIAN MONSALVE CASTAÑEDA',
  'Marisella Castaño Estrada': 'MARISELLA CASTAÑO ESTRADA',
  'Maria Fernanda Cuellar Duque': 'MARIA FERNANDA CUELLAR DUQUE',
  'MAGALY ARISTIZABAL': 'SHIRLEY MAGALY ARISTIZABAL GÓMEZ',
  'ANA SOFIA ARISTIZABAL': 'ANA SOFIA ARISTIZABAL CASTAÑO',
  'EIDER SEBASTIAN ARISTIZABAL GOMEZ': 'EIDER SEBASTIAN ARISTIZABAL GOMEZ',
  'JUAN GUILLERMO HENAO': 'JUAN GUILLERMO HENAO MARIN',
  'JADER GOMEZ': 'JADER DE JESUS  GOMEZ GOMEZ',
  'MANUELA CASTAÑO RAMIREZ': 'MANUELA CASTAÑO RAMIREZ',
  'SANDRA PAOLA TABORDA CASAS': 'SANDRA PAOLA TABORDA CASAS',
  'SANDRA YANET MARIN ALZATE': 'SANDRA YANETH MARIN ALZATE',
  'JUAN DAVID HENAO MARIN': 'JUAN DAVID HENAO MARIN',
  'YEISON ESNEIDER GOMEZ GOMEZ': 'YEISON ESNEIDER GOMEZ GOMEZ',
  'DUVAN ALEXIS GIRALDO CASTAÑO': 'DUVAN ALEXIS GIRALDO CASTAÑO',
  'VICTOR SANTIAGO DOMINGUEZ': 'VICTOR SANTIAGO DOMINGUEZ',
  'DORIS YARLIN GIRALDO': 'DORIS YARLIN GIRALDO QUINTERO',
  'Monica Naranjo Marin': 'MONICA NARANJO MARIN',
  'ALEXIS ARISTIZABAL': 'ALEXIS ARISTIZABAL ARISTIZABAL',
  'NATALIA GONZALEZ': 'ERIKA NATALIA GONZALEZ SUAREZ',
  'YULI BETANCUR': 'YULI ANDREA BETANCUR GUARIN',
  'YENNIFER GARCIA': 'YENNIFER GARCIA RAMIREZ',
  'LINA GIRALDO': 'LINA MARIA GIRALDO CASTAÑO',
  'YULIANA DUQUE': 'YULIANA DUQUE ARISTIZABAL',
  'VIVIANA HERNANDEZ': 'VIVIANA HERNANDEZ ZAPATA',
  'YUDY GALEANO CABARCAS': 'YUDY ESTEFANY GALEANO CABARCAS',
  'MARIANA MONTOYA': 'MARIANA MONTOYA AGUDELO',
  'LUISA ARISTIZABAL': 'LUISA ALEJANDRA ARISTIZABAL LOPEZ',
  'NEYDER JIMENEZ': 'NEIDER DARIO JIMENEZ MEJIA',
  'SANTIAGO HEREDIA': 'SANTIAGO HEREDIA CORREA',
  'SUSANA TAPIAS': 'SUSANA TAPIAS RESTREPO',
  'ISABEL SOFIA ECHEVERRI': 'ISABEL SOFIA ECHEVERRI MONTOYA',
};

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
interface PortalUser {
  user: {
    userId: string;
    name: string;
    leaderId?: string | null;
  };
  balance: {
    accrued: number;
    taken: number;
    pending: number;
    available: number;
    projectedAvailable: number;
    adjustment: number;
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
  r = r.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  r = r.replace(/[^A-Z ]/g, ' ');
  return r.replace(/\s+/g, ' ').trim();
}

// Redondeo half-to-even como Python
function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (Math.abs(frac - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
function main(): void {
  if (!fs.existsSync(EXPORT_PORTAL_PATH)) {
    throw new Error(`No existe el export del portal: ${EXPORT_PORTAL_PATH}`);
  }
  if (!fs.existsSync(RECONCILIACION_PATH)) {
    throw new Error(
      `No existe el CSV de reconciliación: ${RECONCILIACION_PATH}`,
    );
  }

  const portal: PortalUser[] = JSON.parse(
    fs.readFileSync(EXPORT_PORTAL_PATH, 'utf-8'),
  );

  // Lookups por nombre normalizado
  const nameToUserid = new Map<string, string>();
  const nameToLeader = new Map<string, string | null>();
  const userIdToBalance = new Map<
    string,
    { accrued: number; taken: number; available: number }
  >();
  for (const p of portal) {
    const key = norm(p.user.name);
    nameToUserid.set(key, p.user.userId);
    nameToLeader.set(key, p.user.leaderId ?? null);
    userIdToBalance.set(p.user.userId, {
      accrued: p.balance.accrued,
      taken: p.balance.taken,
      available: p.balance.available,
    });
  }

  const fechaCorte = FECHA_CORTE;

  const entries: Entry[] = [];
  const mediosDias: Array<[string, number, number]> = [];
  const sinUserid: string[] = [];
  const sinLeader: string[] = [];
  const conflictosNegativos: Array<[string, number, number, number]> = [];
  const deltasNegativos: Array<[string, number, number, number]> = [];
  const deltasCero: Array<[string, number, number]> = [];

  const csvContent = fs.readFileSync(RECONCILIACION_PATH, 'utf-8');
  const records: Record<string, string>[] = parseCsv(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  for (const row of records) {
    const nombreRaw = row['nombre'];
    if (!nombreRaw) continue;

    // 1) Resolver alias y normalizar
    const nombre = ALIAS[nombreRaw] ?? nombreRaw;
    const nombreNorm = norm(nombre);

    const userid = nameToUserid.get(nombreNorm);
    if (!userid) {
      sinUserid.push(nombreRaw);
      continue;
    }

    // 2) Excluir conflictos negativos marcados en el CSV
    if (row['conflicto_negativo'] && row['conflicto_negativo'].trim() !== '') {
      const actual = parseFloat(row['ACTUAL_taken'] || '0');
      const nuevo = parseFloat(row['NUEVO_taken'] || '0');
      conflictosNegativos.push([nombreRaw, actual, nuevo, nuevo - actual]);
      continue;
    }

    // 3) Resolver leaderId
    const leaderId = nameToLeader.get(nombreNorm) ?? LEADER_ID;
    if (!leaderId) {
      sinLeader.push(nombreRaw);
      continue;
    }

    // 4) Calcular delta contra el portal EN VIVO (no contra el CSV)
    const nuevoTaken = parseFloat(row['NUEVO_taken'] || '0');
    const portalTaken = userIdToBalance.get(userid)?.taken ?? 0;
    const delta = MODO_DELTA ? nuevoTaken - portalTaken : nuevoTaken;

    // 5) Si delta == 0, ya está al día
    if (Math.abs(delta) < 1e-9) {
      deltasCero.push([nombreRaw, portalTaken, nuevoTaken]);
      continue;
    }

    // 6) Deltas negativos no se pueden migrar por append
    if (SOLO_DELTA_POSITIVO && delta < 0) {
      deltasNegativos.push([nombreRaw, portalTaken, nuevoTaken, delta]);
      continue;
    }

    // 7) Redondear a entero (businessDays)
    const deltaRounded = pythonRound(delta);
    if (Math.abs(delta - deltaRounded) > 1e-9) {
      mediosDias.push([nombreRaw, delta, deltaRounded]);
    }

    // 8) No migrar redondeos que quedan en 0
    if (deltaRounded === 0) {
      deltasCero.push([nombreRaw, portalTaken, nuevoTaken]);
      continue;
    }

    entries.push({
      userId: userid,
      leaderId,
      businessDays: deltaRounded,
      startDate: fechaCorte as string,
      endDate: fechaCorte as string,
      reason: `Ajuste delta vacaciones al ${fechaCorte} [${LOTE}]`,
      newAdjustment: 0,
    });
  }

  const payload = { dryRun: DRY_RUN, entries };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  // ───────────────────────────────────────────────────────────
  // Reporte
  // ───────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  MIGRACIÓN VACACIONES — ${LOTE}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Entradas generadas : ${entries.length}`);
  console.log(
    `  Modo               : ${MODO_DELTA ? 'DELTA (NUEVO - portal_actual)' : 'ABSOLUTO'}`,
  );
  console.log(`  Fecha de corte     : ${fechaCorte}`);
  console.log(`  Dry run            : ${DRY_RUN}`);
  console.log(`  Output             : ${OUT_PATH}`);
  console.log('═══════════════════════════════════════════════════════');

  if (sinUserid.length) {
    console.log(
      `\n❌ NO ENCONTRADOS EN PORTAL (${sinUserid.length}) — revisa alias:`,
    );
    for (const n of sinUserid) console.log(`   - ${n}`);
  }

  if (sinLeader.length) {
    console.log(
      `\n⚠️  SIN LEADER (${sinLeader.length}) — no se pueden migrar:`,
    );
    for (const n of sinLeader) console.log(`   - ${n}`);
  }

  if (conflictosNegativos.length) {
    console.log(
      `\n⚠️  CONFLICTO NEGATIVO (${conflictosNegativos.length}) — requieren ajuste manual:`,
    );
    for (const [n, actual, nuevo, delta] of conflictosNegativos) {
      console.log(
        `   - ${n}: portal=${actual}, excel=${nuevo}, delta=${delta}`,
      );
    }
  }

  if (deltasNegativos.length) {
    console.log(
      `\n⚠️  DELTA NEGATIVO (${deltasNegativos.length}) — requieren ajuste manual (append no resta):`,
    );
    for (const [n, actual, nuevo, delta] of deltasNegativos) {
      console.log(
        `   - ${n}: portal=${actual}, excel=${nuevo}, delta=${delta}`,
      );
    }
  }

  if (deltasCero.length) {
    console.log(`\n✅ YA AL DÍA (${deltasCero.length}) — no se tocan:`);
    for (const [n, actual, nuevo] of deltasCero) {
      console.log(`   - ${n}: portal=${actual}, excel=${nuevo}`);
    }
  }

  if (mediosDias.length) {
    console.log(`\n🔢 REDONDEOS HALF-TO-EVEN (${mediosDias.length}):`);
    for (const [n, raw, rounded] of mediosDias) {
      console.log(`   - ${n}: ${raw} -> ${rounded}`);
    }
  }

  console.log('\n✔ Listo. Revisa el reporte antes de poner DRY_RUN=false.\n');
}

main();
