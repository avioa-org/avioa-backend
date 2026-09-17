import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import {
  EquipmentCategory,
  EquipmentStatus,
  LoanStatus,
} from '../../../generated/prisma/enums';
import { envs } from '../../config/env.config';

// Cargar variables de entorno ANTES de crear el cliente

const adapter = new PrismaPg({
  connectionString: envs.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const JSON_PATH = path.join(__dirname, './data/equipos-classified.json');
const REPORTS_DIR = path.join(__dirname, './data/reports');

// ===== HELPERS =====

// Limpia espacios dobles y al inicio/final. Mantiene mayúsculas, acentos y Ñ.
function cleanName(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

async function findUserByName(
  nameFromJson: string,
): Promise<{ userId: string; name: string } | null> {
  const cleaned = cleanName(nameFromJson);

  // Match exacto
  const user = await prisma.user.findFirst({
    where: { name: { contains: cleaned } },
    select: { userId: true, name: true },
  });

  if (user) return user;

  // Match case-insensitive como respaldo
  const userCI = await prisma.user.findFirst({
    where: { name: { contains: cleaned, mode: 'insensitive' } },
    select: { userId: true, name: true },
  });

  return userCI || null;
}

async function importEquipment() {
  // Leer el JSON
  if (!fs.existsSync(JSON_PATH)) {
    console.error('No se encontró el JSON en:', JSON_PATH);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(`${data.length} registros para importar`);

  // 2. Cargar locations
  const locations = await prisma.location.findMany();
  const locationMap = new Map(
    locations.map((l) => [cleanName(l.name), l.locationId]),
  );
  console.log(`${locations.length} ubicaciones cargadas`);

  // 3. Cargar usuarios
  const users = await prisma.user.findMany({
    select: { userId: true, name: true, email: true },
  });
  console.log(`${users.length} usuarios cargados`);

  // 4. Contadores
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const unassignedUsers: any[] = [];
  const skippedDuplicates: any[] = [];
  const notFoundLocations: any[] = [];

  // 5. Procesar cada fila
  for (const row of data) {
    try {
      // 5.1. Saltar los marcados con reviewReason de duplicado
      if (row.reviewReason?.includes('Serial duplicado')) {
        skippedDuplicates.push(row);
        skipped++;
        continue;
      }

      // 5.2. Verificar si el serial ya existe en BD
      if (row.serialNumber) {
        const exists = await prisma.equipment.findUnique({
          where: { serialNumber: row.serialNumber },
        });
        if (exists) {
          console.log(
            `Fila ${row._rowIndex}: ya existe (serial ${row.serialNumber})`,
          );
          skipped++;
          continue;
        }
      }

      // 5.3. Buscar location
      let locationId: string | null = null;
      if (row.location) {
        const found = locationMap.get(cleanName(row.location));
        if (found) {
          locationId = found;
        } else {
          console.warn(
            `Fila ${row._rowIndex}: location "${row.location}" no encontrada`,
          );
          notFoundLocations.push(row);
        }
      }

      // 5.4. Validar categoría
      const validCategories = Object.values(EquipmentCategory);
      const category = validCategories.includes(row.category)
        ? row.category
        : EquipmentCategory.OTHER;

      // 5.5. Crear el equipo
      const equipment = await prisma.equipment.create({
        data: {
          name: row.description,
          serialNumber: row.serialNumber || null,
          category: category as EquipmentCategory,
          status: EquipmentStatus.AVAILABLE,
          locationId,
          description: row.needsReview
            ? `[REVISAR] ${row.reviewReason || ''}`
            : null,
        },
      });

      // 5.6. Si tiene asignado a alguien, crear el loan
      if (!row.isAvailable && row.assignedToUserName) {
        const matchedUser = await findUserByName(row.assignedToUserName);

        if (matchedUser) {
          await prisma.equipmentLoan.create({
            data: {
              equipmentId: equipment.equipmentId,
              userId: matchedUser.userId,
              reason: 'Migración inicial de inventario',
              observation: `Asignado desde Excel. Nombre original: ${row.assignedToRaw}`,
              status: LoanStatus.APPROVED,
            },
          });

          // Marcar equipo como LOANED
          await prisma.equipment.update({
            where: { equipmentId: equipment.equipmentId },
            data: { status: EquipmentStatus.LOANED },
          });

          console.log(
            `Fila ${row._rowIndex}: ${equipment.name} → ${matchedUser.name}`,
          );
        } else {
          console.warn(
            `Fila ${row._rowIndex}: usuario "${row.assignedToUserName}" no encontrado. Queda AVAILABLE.`,
          );
          unassignedUsers.push(row);
        }
      }

      created++;
    } catch (error) {
      console.error(`Fila ${row._rowIndex}:`, error);
      errors++;
    }
  }

  // 6. Reportes
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  if (unassignedUsers.length > 0) {
    const report = {
      totalUnassigned: unassignedUsers.length,
      unassigned: unassignedUsers.map((r) => ({
        rowIndex: r._rowIndex,
        description: r.description,
        serialNumber: r.serialNumber,
        assignedToUserName: r.assignedToUserName,
      })),
    };
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'unassigned-users.json'),
      JSON.stringify(report, null, 2),
    );
  }

  if (skippedDuplicates.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'skipped-duplicates.json'),
      JSON.stringify(skippedDuplicates, null, 2),
    );
  }

  if (notFoundLocations.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'not-found-locations.json'),
      JSON.stringify(notFoundLocations, null, 2),
    );
  }

  // 7. Resumen final
  console.log('\n═══════════════════════════════════');
  console.log('  RESUMEN DE IMPORTACIÓN');
  console.log('═══════════════════════════════════');
  console.log(`Creados:              ${created}`);
  console.log(`Omitidos:             ${skipped}`);
  console.log(`Errores:              ${errors}`);
  console.log(`Sin usuario:          ${unassignedUsers.length}`);
  console.log(`Location no hallada:  ${notFoundLocations.length}`);
  console.log('═══════════════════════════════════\n');

  if (unassignedUsers.length > 0) {
    console.log(
      `Reporte de no asignados: ${path.join(REPORTS_DIR, 'unassigned-users.json')}`,
    );
  }

  await prisma.$disconnect();
}

importEquipment().catch((e) => {
  console.error(e);
  process.exit(1);
});
