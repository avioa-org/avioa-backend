import { LeaveStatus, LeaveType } from 'generated/prisma/enums';
import { HISTORICAL_MIGRATION_TAG } from '../../modules/leaves/leaves.service';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from '../../config/env.config';

const connectionString = envs.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

const dryRun = process.argv[2] === 'true';

async function migrateNegativeAdjustment(dryRun = true) {
  const FECHA_MIGRACION = new Date('2026-09-18T00:00:00.000Z');
  const users = await prisma.user.findMany({
    where: { vacationDaysAdjustment: { lt: 0 } },
    select: {
      userId: true,
      name: true,
      startDate: true,
      leaderId: true,
      vacationDaysAdjustment: true,
    },
  });

  console.log(`Encontrados ${users.length} usuarios con adjustment negativo`);

  const results: Array<{ name: string; dias: number; status: string }> = [];

  for (const user of users) {
    const dias = Math.abs(user.vacationDaysAdjustment);

    if (dryRun) {
      results.push({ name: user.name, dias, status: 'DRY_RUN' });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.create({
          data: {
            userId: user.userId,
            leaderId: user.leaderId as string,
            type: LeaveType.VACACIONES,
            businessDays: dias,
            startDate: FECHA_MIGRACION,
            endDate: FECHA_MIGRACION,
            status: LeaveStatus.APPROVED,
            reason: `${HISTORICAL_MIGRATION_TAG} [adjustment ${user.vacationDaysAdjustment}]`,
            esCompensada: false,
            reviewedAt: new Date(),
          },
        });

        await tx.user.update({
          where: { userId: user.userId },
          data: { vacationDaysAdjustment: 0 },
        });
      });
      results.push({ name: user.name, dias, status: 'OK' });
    } catch (err) {
      results.push({
        name: user.name,
        dias,
        status: `ERROR: ${(err as Error).message}`,
      });
    }
  }

  console.log(results);
}

migrateNegativeAdjustment(dryRun).then(() => {
  prisma.$disconnect();
  process.exit(0);
});
