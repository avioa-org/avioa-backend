import 'dotenv/config';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { envs } from '../../config/env.config';
import { hash } from 'bcrypt';

const connectionString = envs.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const usersIdAndDocumentNumbers = await prisma.user.findMany({
    select: {
      userId: true,
      documentNumber: true,
    },
  });

  for (const user of usersIdAndDocumentNumbers) {
    if (user.documentNumber) {
      const newPassword = user.documentNumber;
      await prisma.user.update({
        where: { userId: user.userId },
        data: {
          password: await hash(newPassword, 10),
          mustChangePassword: true,
        },
      });
    }

    console.log(
      `Password changed for user ${user.userId} to ${user.documentNumber}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
