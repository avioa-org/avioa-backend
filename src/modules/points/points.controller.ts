import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { PointRequestService } from './services/point-request.service';
import { PointWalletService } from './services/point-wallet.service';
import { PointTransactionService } from './services/point-transaction.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ValidateAdminGuard } from 'src/common/guards/validate-admin.guard';
import { RewardService } from './services/reward.service';
import { CreateBulkRewardDto, CreateRewardDto } from './dto/create-reward.dto';
import type { Request } from 'express';

@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly pointRequestService: PointRequestService,
    private readonly pointWalletService: PointWalletService,
    private readonly pointTransactionService: PointTransactionService,
    private readonly rewardService: RewardService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-requests')
  public async getMyRequests() {}

  @UseGuards(JwtAuthGuard)
  @Get('pending') // Con este endpoint el lider puede ver las solicitudes pendientes
  public async getPendingRequests() {}

  @UseGuards(JwtAuthGuard)
  @Get('wallet') // Puntos actuales
  public async getWallet(@Req() req: Request) {
    return await this.pointWalletService.getWallet(req['user'].userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history') // Historial de transacciones
  public async getHistory() {}

  @UseGuards(JwtAuthGuard)
  @Get('rewards') // Todos los recompensas
  public async getRewards() {
    return await this.rewardService.getRewards();
  }

  @UseGuards(JwtAuthGuard)
  @Post('request')
  public async requestPoints(@Body() payload) {}

  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  @Post('reward/create')
  public async createReward(@Body() createRewardDto: CreateRewardDto) {
    return await this.rewardService.createReward(createRewardDto);
  }

  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  @Post('reward/create/bulk')
  public async createBulkRewards(@Body() rewards: CreateBulkRewardDto) {
    return await this.rewardService.createBulkRewards(rewards);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':pointRequestId/approve')
  public async approveRequest(
    @Param('pointRequestId') pointRequestId: string,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Patch(':pointRequestId/reject')
  public async rejectRequest(@Param('pointRequestId') pointRequestId: string) {}
}
