import 'dotenv/config';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from '../../config/env.config';
import * as path from 'path';
import * as fs from 'fs';

const connectionString = envs.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface LeadersData {
  lider: string;
  subordinados: string[];
}

// const JSON_PATH = path.join(__dirname, './data/lideres.json');
const JSON_PATH = process.argv[2] ?? '/tmp/lideres.json';

const leadershipData: LeadersData[] = JSON.parse(
  fs.readFileSync(JSON_PATH, 'utf-8'),
);

interface ErrorRecord {
  documentNumber: string;
  reason: string;
}

interface AssignmentResult {
  documentNumber: string;
  name: string;
  leaderId: string;
  leaderName: string;
}

async function assignLeaders() {
  console.log('Iniciando asignacion de lideres...\n');

  const asignados: AssignmentResult[] = [];
  const errores: ErrorRecord[] = [];
  const omitidos = [];

  const allUsers = await prisma.user.findMany({
    select: {
      userId: true,
      name: true,
      documentNumber: true,
    },
  });

  const userMap = new Map<string, { userId: string; name: string }>();
  allUsers.forEach((user) => {
    if (user.documentNumber) {
      userMap.set(user.documentNumber, {
        userId: user.userId,
        name: user.name,
      });
    }
  });

  for (const group of leadershipData) {
    const liderDocumentNumber = group.lider;
    const lider = userMap.get(liderDocumentNumber);

    if (!lider) {
      console.warn(`Lider ${liderDocumentNumber} no encontrado`);
      errores.push({
        documentNumber: liderDocumentNumber,
        reason: 'Lider no encontrado en la base de datos',
      });
      continue;
    }
    console.log(`Líder: ${lider.name} (${liderDocumentNumber})`);

    for (const subDocumentNumber of group.subordinados) {
      const subordinado = userMap.get(subDocumentNumber);

      if (!subordinado) {
        console.warn(`  Subordinado ${subDocumentNumber} no encontrado`);
        errores.push({
          documentNumber: subDocumentNumber,
          reason: 'Subordinado no encontrado en la base de datos',
        });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { userId: lider.userId },
            data: {
              isLeader: true,
              role: 'LEADER',
            },
          });
          await tx.user.update({
            where: { userId: subordinado.userId },
            data: { leaderId: lider.userId },
          });
        });

        console.log(
          `  Subordinado ${subordinado.name} (${subDocumentNumber}) asignado al lider ${lider.name} (${liderDocumentNumber})`,
        );
        asignados.push({
          documentNumber: subDocumentNumber,
          name: subordinado.name,
          leaderId: lider.userId,
          leaderName: lider.name,
        });
      } catch (error) {
        console.error(error);
        errores.push({
          documentNumber: subDocumentNumber,
          reason: 'Error desconocido al actualizar',
        });
      }
    }
  }

  console.log(`Asignaciones realizadas: ${asignados.length}`);
  console.log(`Errores encontrados: ${errores.length}`);
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
  console.log(
    `Porcentaje: ${((usersWithLeader / totalUsers) * 100).toFixed(2)}%\n`,
  );

  // Verificar que los líderes existen en la base de datos
  const uniqueLeaders = new Set(leadershipData.map((group) => group.lider));
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
  await assignLeaders();
  await verifyAssignment();
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
