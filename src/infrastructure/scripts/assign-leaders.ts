import 'dotenv/config';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from '../../config/env.config';

const connectionString = envs.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const leadershipData = [
  {
    lider: '1036401928',
    subordinados: ['1001032752', '1015216619', '1117488776', '1001652083'],
  },
  {
    lider: '1036636904',
    subordinados: [
      '1038409160',
      '1141317000',
      '1000809145',
      '1026287284',
      '1038410434',
      '1000639654',
      '1036962637',
      '1035915805',
      '1001479071',
      '1036394001',
      '43112134',
      '43210338',
      '1041231139',
      '1128387642',
      '1001618499',
      '1007338197',
      '1038413531',
      '1037238468',
      '1144193623',
      '1025761932',
      '1036930237',
      '1038411292',
      '1045017082',
      '1038412799',
      '1025644553',
      '1026154158',
      '1036947278',
      '1035917438',
      '1036944158',
      '1193105991',
      '1036963659',
    ],
  },
  {
    lider: '1035920728',
    subordinados: ['1038412680'],
  },
  {
    lider: '1007364940',
    subordinados: ['1001893730', '1005230261', '1001137619', '1001470290'],
  },
  {
    lider: '1038417777',
    subordinados: [
      '1040873723',
      '1025764273',
      '1127607258',
      '1007358155',
      '1038409537',
      '1038418301',
      '1038404513',
      '1001546386',
    ],
  },
  {
    lider: '1007338175',
    subordinados: [
      '1038413709',
      '1152442897',
      '1007382202',
      '1007382182',
      '1109663888',
      '1038409066',
    ],
  },
  {
    lider: '1000639654',
    subordinados: ['1000990774', '1015186382'],
  },
  {
    lider: '43607493',
    subordinados: ['1001497331'],
  },
  {
    lider: '1038418013',
    subordinados: [
      '1036925580',
      '1036256457',
      '1041231895',
      '1038418916',
      '1036959261',
      '1108567060',
      '1036959275',
    ],
  },
  {
    lider: '1041233336',
    subordinados: ['1038418146', '1023522133', '1036926615'],
  },
];

interface AssignmentResult {
  documentNumber: string;
  name: string;
  leaderId: string;
  leaderName: string;
}

interface ErrorRecord {
  documentNumber: string;
  name?: string;
  leaderId: string;
  reason: string;
}

async function assignLeaders() {
  console.log('Iniciando asignacion de lideres...\n');

  const assigned: AssignmentResult[] = [];
  const errors: ErrorRecord[] = [];
  let totalUpdated = 0;

  // Obtener todos los usuarios de una vez para optimizar
  const allUsers = await prisma.user.findMany({
    select: {
      userId: true,
      name: true,
      documentNumber: true,  // CORREGIDO: documentNumber en lugar de document_number
    },
  });

  // Crear un mapa para búsqueda rápida por documentNumber
  const userMap = new Map<string, { userId: string; name: string }>();
  allUsers.forEach((user) => {
    if (user.documentNumber) {
      userMap.set(user.documentNumber, {
        userId: user.userId,
        name: user.name,
      });
    }
  });

  // Procesar cada grupo de liderazgo
  for (const group of leadershipData) {
    const liderDocumentNumber = group.lider;
    const lider = userMap.get(liderDocumentNumber);

    if (!lider) {
      console.error(`Líder con documento ${liderDocumentNumber} no encontrado`);
      for (const sub of group.subordinados) {
        errors.push({
          documentNumber: sub,
          leaderId: liderDocumentNumber,
          reason: `Líder ${liderDocumentNumber} no encontrado en la base de datos`,
        });
      }
      continue;
    }

    console.log(`Líder: ${lider.name} (${liderDocumentNumber})`);

    // Procesar cada subordinado
    for (const subDocumentNumber of group.subordinados) {
      const subordinado = userMap.get(subDocumentNumber);

      if (!subordinado) {
        console.warn(`  Subordinado ${subDocumentNumber} no encontrado`);
        errors.push({
          documentNumber: subDocumentNumber,
          leaderId: liderDocumentNumber,
          reason: 'Subordinado no encontrado en la base de datos',
        });
        continue;
      }

      try {
        await prisma.user.update({
          where: { userId: subordinado.userId },
          data: { leaderId: lider.userId },
        });

        console.log(`  ${subordinado.name} (${subDocumentNumber}) -> ${lider.name}`);
        assigned.push({
          documentNumber: subDocumentNumber,
          name: subordinado.name,
          leaderId: lider.userId,
          leaderName: lider.name,
        });
        totalUpdated++;
      } catch (error) {
        console.error(`  Error actualizando ${subDocumentNumber}:`, error);
        errors.push({
          documentNumber: subDocumentNumber,
          name: subordinado.name,
          leaderId: liderDocumentNumber,
          reason: error instanceof Error ? error.message : 'Error desconocido al actualizar',
        });
      }
    }
    console.log('');
  }

  // Resumen final
  console.log('RESUMEN DE ASIGNACION');
  console.log('='.repeat(50));
  console.log(`Usuarios actualizados: ${totalUpdated}`);
  console.log(`Errores: ${errors.length}`);
  console.log(`Total lideres procesados: ${leadershipData.length}\n`);

  // Mostrar detalles de errores si los hay
  if (errors.length > 0) {
    console.log('DETALLES DE ERRORES:');
    console.log('-'.repeat(50));
    errors.forEach((err) => {
      console.log(
        `  Subordinado: ${err.documentNumber}${err.name ? ` (${err.name})` : ''}`,
      );
      console.log(`    Lider esperado: ${err.leaderId}`);
      console.log(`    Razón: ${err.reason}\n`);
    });
  }

  // Mostrar algunos ejemplos de asignaciones exitosas
  if (assigned.length > 0) {
    console.log('EJEMPLOS DE ASIGNACIONES EXITOSAS:');
    console.log('-'.repeat(50));
    const sampleSize = Math.min(5, assigned.length);
    for (let i = 0; i < sampleSize; i++) {
      const item = assigned[i];
      console.log(
        `  ${item.name} (${item.documentNumber}) -> Lider: ${item.leaderName}`,
      );
    }
    if (assigned.length > 5) {
      console.log(`  ... y ${assigned.length - 5} asignaciones mas`);
    }
  }

  return { assigned, errors, totalUpdated };
}

async function verifyAssignment() {
  console.log('\nVERIFICANDO ASIGNACIONES EN LA BASE DE DATOS');
  console.log('='.repeat(50));

  const totalUsers = await prisma.user.count();
  const usersWithLeader = await prisma.user.count({
    where: { leaderId: { not: null } },
  });

  console.log(`Total usuarios en BD: ${totalUsers}`);
  console.log(`Usuarios con lider asignado: ${usersWithLeader}`);
  console.log(`Porcentaje: ${((usersWithLeader / totalUsers) * 100).toFixed(2)}%\n`);

  // Verificar que los líderes existen en la base de datos
  const uniqueLeaders = new Set(
    leadershipData.map((group) => group.lider),
  );
  const leadersInDb = await prisma.user.findMany({
    where: {
      documentNumber: { in: Array.from(uniqueLeaders) },
    },
    select: {
      documentNumber: true,
      name: true,
    },
  });

  const foundLeaders = new Set(leadersInDb.map((l) => l.documentNumber));
  const missingLeaders = Array.from(uniqueLeaders).filter(
    (doc) => !foundLeaders.has(doc),
  );

  if (missingLeaders.length > 0) {
    console.log('LIDERES NO ENCONTRADOS EN BD:');
    missingLeaders.forEach((doc) => {
      console.log(`  Documento: ${doc}`);
    });
  } else {
    console.log('Todos los lideres especificados existen en la base de datos');
  }

  // Mostrar algunas relaciones como ejemplo
  const sampleRelations = await prisma.user.findMany({
    where: { leaderId: { not: null } },
    select: {
      name: true,
      documentNumber: true,
      leader: {
        select: {
          name: true,
          documentNumber: true,
        },
      },
    },
    take: 5,
  });

  if (sampleRelations.length > 0) {
    console.log('\nEJEMPLOS DE RELACIONES EN BD:');
    sampleRelations.forEach((user) => {
      console.log(
        `  ${user.name} (${user.documentNumber}) -> Lider: ${user.leader?.name} (${user.leader?.documentNumber})`,
      );
    });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  ASIGNACION DE LIDERES A SUBORDINADOS');
  console.log('='.repeat(60) + '\n');

  try {
    await assignLeaders();
    await verifyAssignment();

    console.log('\nAsignacion completada exitosamente');
  } catch (error) {
    console.error('Error ejecutando el script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();