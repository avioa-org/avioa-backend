import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class VaultDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { userId },
      select: { department: true },
    });

    const accessWhere: Prisma.PasswordVaultWhereInput = {
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { permissions: { some: { userId } } },
        ...(user.department
          ? [{ permissions: { some: { department: user.department } } }]
          : []),
      ],
    };

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const [total, shared, expiringSoon, weak, uncategorized, duplicateGroups] =
      await Promise.all([
        this.prisma.passwordVault.count({ where: accessWhere }),
        this.prisma.passwordVault.count({
          where: { ...accessWhere, permissions: { some: {} } },
        }),
        this.prisma.passwordVault.count({
          where: {
            ...accessWhere,
            expiresAt: { lte: in30Days, gte: new Date() },
          },
        }),
        this.prisma.passwordVault.count({
          where: {
            ...accessWhere,
            strengthLevel: { in: ['VERY_WEAK', 'WEAK'] },
          },
        }),
        this.prisma.passwordVault.count({
          where: { ...accessWhere, categoryId: null },
        }),
        this.getDuplicateCounts(accessWhere),
      ]);

    return {
      total,
      shared,
      expiringSoon,
      weak,
      uncategorized,
      duplicates: duplicateGroups,
    };
  }

  private async getDuplicateCounts(
    accessWhere: Prisma.PasswordVaultWhereInput,
  ): Promise<number> {
    const groups = await this.prisma.passwordVault.groupBy({
      by: ['passwordHash'],
      where: { ...accessWhere, passwordHash: { not: null } },
      _count: { passwordHash: true },
      having: { passwordHash: { _count: { gt: 1 } } },
    });

    return groups.reduce((sum, g) => sum + g._count.passwordHash, 0);
  }
}
