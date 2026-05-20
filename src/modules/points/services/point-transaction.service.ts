import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class PointTransactionService {
  private readonly logger = new Logger(PointTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async getHistory(userId: string) {
    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: transactions,
      message: 'Historial de transacciones obtenido exitosamente',
    };
  }
}
