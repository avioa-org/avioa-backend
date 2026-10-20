// reset-equipment-data.ts
//
// Uso:
//   Dry run (solo cuenta qué borraría):
//     npx tsx src/infrastructure/scripts/reset-equipment-data.ts
//
//   Apply (borra de verdad):
//     npx tsx src/infrastructure/scripts/reset-equipment-data.ts --apply
//
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { envs } from '../../config/env.config';

const adapter = new PrismaPg({
  connectionString: envs.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const APPLY_MODE = process.argv.includes('--apply');

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(
    APPLY_MODE
      ? '  MODO APPLY (va a BORRAR datos)'
      : '  MODO DRY-RUN (solo preview)',
  );
  console.log('═══════════════════════════════════════════════\n');


  const counts = {
    equipmentLoans: await prisma.equipmentLoan.count(),
    maintenanceRequests: await prisma.maintenanceRequest.count(),
    equipment: await prisma.equipment.count(),
  };

  console.log('Datos actuales:');
  console.log(`  Equipment loans:         ${counts.equipmentLoans}`);
  console.log(`  Maintenance requests:    ${counts.maintenanceRequests}`);
  console.log(`  Equipment:               ${counts.equipment}`);
  console.log('');

  if (
    counts.equipmentLoans === 0 &&
    counts.maintenanceRequests === 0 &&
    counts.equipment === 0
  ) {
    console.log('✅ No hay datos para borrar.');
    return;
  }

  if (!APPLY_MODE) {
    console.log(
      'Estás en DRY-RUN. Para borrar de verdad, corre con --apply\n',
    );
    return;
  }


  console.log('ADVERTENCIA: esta operación es IRREVERSIBLE.');
  console.log(
    '   Se borrarán TODOS los loans, mantenimientos y equipos de la BD.\n',
  );


  await prisma.$transaction(async (tx) => {

    const delLoans = await tx.equipmentLoan.deleteMany({});
    console.log(`Equipment loans borrados: ${delLoans.count}`);


    const delMaintenance = await tx.maintenanceRequest.deleteMany({});
    console.log(
      `Maintenance requests borrados: ${delMaintenance.count}`,
    );


    const delEquipment = await tx.equipment.deleteMany({});
    console.log(` Equipment borrados: ${delEquipment.count}`);
  });


  const finalCounts = {
    equipmentLoans: await prisma.equipmentLoan.count(),
    maintenanceRequests: await prisma.maintenanceRequest.count(),
    equipment: await prisma.equipment.count(),
  };

  console.log('\n Estado final:');
  console.log(`  Equipment loans:         ${finalCounts.equipmentLoans}`);
  console.log(`  Maintenance requests:    ${finalCounts.maintenanceRequests}`);
  console.log(`  Equipment:               ${finalCounts.equipment}`);

  if (
    finalCounts.equipmentLoans === 0 &&
    finalCounts.maintenanceRequests === 0 &&
    finalCounts.equipment === 0
  ) {
    console.log('\n Limpieza completa. La BD está lista para re-importar.');
  } else {
    console.log('\n Quedan datos. Revisa.');
  }
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });