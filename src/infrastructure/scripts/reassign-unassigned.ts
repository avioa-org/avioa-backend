// para ejecutar este script usa esto (MODO DRY-RUN: npx tsx src/infrastructure/scripts/reassign-unassigned.ts)

//(MODO: APPLY: npx tsx src/infrastructure/scripts/reassign-unassigned.ts --apply)
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { EquipmentStatus, LoanStatus } from '../../../generated/prisma/enums';
import { envs } from '../../config/env.config';

const adapter = new PrismaPg({
  connectionString: envs.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// const REPORT_INPUT = path.resolve(
//   process.cwd(),
//   'src/infrastructure/scripts/reports/unassigned-users.json',
// );

// const REPORTS_DIR = path.resolve(
//   process.cwd(),
//   'src/infrastructure/scripts/reports',
// );

const REPORT_INPUT = process.argv[2];

if (!REPORT_INPUT) {
  console.error('❌ Debes proporcionar la ruta del archivo de reporte.');
  process.exit(1);
}

const REPORTS_DIR = process.argv[3] ?? '/reports';

const APPLY_MODE = process.argv.includes('--apply');
const MIN_SCORE = 0.7;

// ===== TYPES =====
interface UnassignedReport {
  totalUnassigned: number;
  unassigned: Array<{
    rowIndex: number;
    description: string;
    serialNumber: string;
    assignedToUserName: string;
  }>;
}

interface User {
  userId: string;
  name: string;
}

interface MatchResult {
  user: User | null;
  score: number;
  candidates: Array<{ user: User; score: number }>;
}

// ===== HELPERS =====
function cleanName(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

function normalizeForMatching(str: string): string {
  return cleanName(str)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quitar acentos
}

function tokenize(str: string): string[] {
  return normalizeForMatching(str)
    .split(' ')
    .filter((t) => t.length > 2);
}

/*
 Busca el mejor match de usuario para un nombre del Excel.
 
 Estrategias (en orden):
  1. Match exacto (normalizado, sin acentos)
  2. Match por tokens: todos los tokens del Excel están en el usuario → score 1.0
  3. Match parcial: ≥ MIN_SCORE de tokens del Excel en el usuario
 
  Retorna el mejor candidato con su score, y la lista de candidatos
  válidos para detectar ambigüedad.
 */
function findBestUserMatch(excelName: string, users: User[]): MatchResult {
  const excelNormalized = normalizeForMatching(excelName);
  const excelTokens = tokenize(excelName);

  // 1. Match exacto
  const exactMatch = users.find(
    (u) => normalizeForMatching(u.name) === excelNormalized,
  );
  if (exactMatch) {
    return {
      user: exactMatch,
      score: 1.0,
      candidates: [{ user: exactMatch, score: 1.0 }],
    };
  }

  // 2 y 3. Match por tokens
  const candidates: Array<{ user: User; score: number }> = [];

  for (const user of users) {
    const userTokens = tokenize(user.name);
    if (userTokens.length === 0) continue;

    // Cuántos tokens del Excel están en el usuario
    const matchedTokens = excelTokens.filter((et) =>
      userTokens.some((ut) => ut === et),
    ).length;

    // Cuántos tokens del usuario están en el Excel (para detectar casos donde
    // el usuario tiene MÁS tokens que el Excel
    const reverseMatched = userTokens.filter((ut) =>
      excelTokens.some((et) => et === ut),
    ).length;

    // Score: usamos la dirección que tenga más cobertura
    const scoreExcelToUser = matchedTokens / excelTokens.length;
    const scoreUserToExcel = reverseMatched / userTokens.length;
    const score = Math.max(scoreExcelToUser, scoreUserToExcel);

    if (score >= MIN_SCORE) {
      candidates.push({ user, score });
    }
  }

  // Ordenar por score descendente
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return { user: null, score: 0, candidates: [] };
  }

  // Detectar ambigüedad: si los top 2 tienen el mismo score, es ambiguo
  if (
    candidates.length >= 2 &&
    Math.abs(candidates[0].score - candidates[1].score) < 0.001
  ) {
    return { user: null, score: candidates[0].score, candidates };
  }

  return { user: candidates[0].user, score: candidates[0].score, candidates };
}

async function reassignUnassigned() {
  console.log('═══════════════════════════════════════════════');
  console.log(
    APPLY_MODE
      ? ' MODO APPLY (va a modificar la BD)'
      : ' MODO DRY-RUN (solo preview)',
  );
  console.log('═══════════════════════════════════════════════\n');

  // 1. Leer el reporte
  if (!fs.existsSync(REPORT_INPUT)) {
    console.error('No se encontró el reporte en:', REPORT_INPUT);
    process.exit(1);
  }

  const report: UnassignedReport = JSON.parse(
    fs.readFileSync(REPORT_INPUT, 'utf-8'),
  );

  console.log(`${report.totalUnassigned} registros en el reporte\n`);

  // 2. Cargar usuarios
  const users = await prisma.user.findMany({
    select: { userId: true, name: true },
  });
  console.log(`👥 ${users.length} usuarios cargados de la BD\n`);

  // 3. Contadores y acumuladores
  let reassigned = 0;
  let skippedEquipmentNotFound = 0;
  let skippedAlreadyAssigned = 0;
  let ambiguous = 0;
  let noMatch = 0;
  let errors = 0;

  const reassignedReport: any[] = [];
  const ambiguousReport: any[] = [];
  const noMatchReport: any[] = [];

  // 4. Procesar cada uno
  for (const item of report.unassigned) {
    try {
      console.log(
        `\n[Fila ${item.rowIndex}] "${item.assignedToUserName}" → ${item.description}`,
      );

      // 4.1. Buscar equipo por serial
      if (!item.serialNumber) {
        console.warn('Sin serialNumber, se omite');
        noMatch++;
        noMatchReport.push({ ...item, reason: 'Sin serialNumber' });
        continue;
      }

      const equipment = await prisma.equipment.findUnique({
        where: { serialNumber: item.serialNumber },
      });

      if (!equipment) {
        console.warn('Equipo no encontrado en BD');
        skippedEquipmentNotFound++;
        continue;
      }

      // 4.2. Si el equipo ya está asignado, skip
      if (equipment.status === EquipmentStatus.LOANED) {
        console.warn('El equipo ya está LOANED, se omite');
        skippedAlreadyAssigned++;
        continue;
      }

      // 4.3. Buscar mejor match
      const match = findBestUserMatch(item.assignedToUserName, users);

      if (!match.user && match.candidates.length >= 2) {
        // Ambigüedad
        console.warn(`   AMBIGUO (${match.candidates.length} candidatos):`);
        match.candidates.slice(0, 3).forEach((c) => {
          console.warn(
            `      - ${c.user.name} (${(c.score * 100).toFixed(0)}%)`,
          );
        });
        ambiguous++;
        ambiguousReport.push({
          ...item,
          candidates: match.candidates.slice(0, 5).map((c) => ({
            userId: c.user.userId,
            name: c.user.name,
            score: c.score,
          })),
        });
        continue;
      }

      if (!match.user) {
        console.warn(`Sin match (score máximo: ${match.score})`);
        noMatch++;
        noMatchReport.push({ ...item, reason: 'Sin match ≥70%' });
        continue;
      }

      // 4.4. Tenemos match
      console.log(
        `MATCH: ${match.user.name} (score: ${(match.score * 100).toFixed(0)}%)`,
      );

      if (!APPLY_MODE) {
        reassigned++;
        reassignedReport.push({
          ...item,
          matchedUserId: match.user.userId,
          matchedUserName: match.user.name,
          score: match.score,
        });
        continue;
      }

      // 4.5. APPLY: crear loan + actualizar equipo
      await prisma.equipmentLoan.create({
        data: {
          equipmentId: equipment.equipmentId,
          userId: match.user.userId,
          reason: 'Migración inicial de inventario',
          observation: `Reasignación post-migración. Nombre original: ${item.assignedToUserName}. Match: ${(match.score * 100).toFixed(0)}%`,
          status: LoanStatus.APPROVED,
        },
      });

      await prisma.equipment.update({
        where: { equipmentId: equipment.equipmentId },
        data: { status: EquipmentStatus.LOANED },
      });

      console.log('Loan creado, equipo → LOANED');

      reassigned++;
      reassignedReport.push({
        ...item,
        matchedUserId: match.user.userId,
        matchedUserName: match.user.name,
        score: match.score,
      });
    } catch (error) {
      console.error(`Error:`, error);
      errors++;
    }
  }

  // 5. Generar reportes
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(REPORTS_DIR, 'reassigned-users.json'),
    JSON.stringify(
      { total: reassigned, reassigned: reassignedReport },
      null,
      2,
    ),
  );

  if (ambiguousReport.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'ambiguous-users.json'),
      JSON.stringify({ total: ambiguous, ambiguous: ambiguousReport }, null, 2),
    );
  }

  if (noMatchReport.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'no-match-users.json'),
      JSON.stringify({ total: noMatch, noMatch: noMatchReport }, null, 2),
    );
  }

  // 6. Resumen
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('═══════════════════════════════════════════════');
  console.log(` Reasignados:              ${reassigned}`);
  console.log(` Ambiguos (revisión):     ${ambiguous}`);
  console.log(` Sin match:               ${noMatch}`);
  console.log(` Equipo no encontrado:    ${skippedEquipmentNotFound}`);
  console.log(` Ya estaba asignado:      ${skippedAlreadyAssigned}`);
  console.log(` Errores:                ${errors}`);
  console.log('═══════════════════════════════════════════════\n');

  console.log('Reportes generados:');
  console.log(`   - reassigned-users.json`);
  if (ambiguousReport.length > 0) {
    console.log(`   - ambiguous-users.json (${ambiguous})`);
  }
  if (noMatchReport.length > 0) {
    console.log(`   - no-match-users.json (${noMatch})`);
  }

  if (!APPLY_MODE) {
    console.log(
      '\n  Estás en DRY-RUN. Para aplicar los cambios, corre con --apply',
    );
  }
}

reassignUnassigned()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
