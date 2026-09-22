import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';
import { envs } from 'src/config/env.config';
import { ROLE_DEFAULT_MODULES } from 'src/common/constants/role-default-modules.constant';

const adapter = new PrismaPg({
  connectionString: envs.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { userId: true, role: true },
  });

  for (const user of users) {
    if (user.role === 'ADMIN') continue;

    const modules = ROLE_DEFAULT_MODULES[user.role] ?? [];
    if (modules.length === 0) continue;

    await prisma.modulePermission.createMany({
      data: modules.map((module) => ({
        userId: user.userId,
        module,
        canAccess: true,
        grantedBy: 'SYSTEM_INTEGRATION',
      })),
      skipDuplicates: true,
    });

    console.log(`✅ ${user.userId} (${user.role}) → ${modules.length} módulos`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
