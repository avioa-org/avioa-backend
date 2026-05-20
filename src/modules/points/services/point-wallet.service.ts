import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class PointWalletService {
  private readonly logger = new Logger(PointWalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async getWallet(userId: string) {
    const wallet = await this.prisma.pointWallet.findUnique({
      where: { userId },
      select: { total: true },
    });

    return { total: wallet?.total || 0 };
  }
}
