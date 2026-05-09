import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PointRequestService } from './services/point-request.service';
import { PointWalletService } from './services/point-wallet.service';
import { PointTransactionService } from './services/point-transaction.service';
import { RewardService } from './services/reward.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [PointsController],
  providers: [
    PointsService,
    PointRequestService,
    PointWalletService,
    PointTransactionService,
    RewardService,
    PrismaService,
  ],
})
export class PointsModule {}
