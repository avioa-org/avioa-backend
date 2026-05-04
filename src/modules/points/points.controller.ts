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
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { RequestPointsDto } from './dto/request-points';
import { ApprovePointRequestDto } from './dto/approve-point-request.dto';
import { RejectPointRequestDto } from './dto/reject-point-request.dto';

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
  public async getMyRequests(@CurrentUser() userId: string) {
    return await this.pointRequestService.getMyRequests(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending') // Con este endpoint el lider puede ver las solicitudes pendientes
  public async getPendingRequests(@CurrentUser() leaderId: string) {
    return await this.pointRequestService.getPendingRequests(leaderId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending/:pointRequestId')
  public async getPendingRequest(
    @CurrentUser() leaderId: string,
    @Param('pointRequestId') pointRequestId: string,
  ) {
    return await this.pointRequestService.getPendingRequest(
      leaderId,
      pointRequestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('wallet') // Puntos actuales
  public async getWallet(@CurrentUser() userId: string) {
    return await this.pointWalletService.getWallet(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history') // Historial de transacciones
  public async getHistory(@CurrentUser() userId: string) {
    return await this.pointTransactionService.getHistory(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rewards') // Todos los recompensas
  public async getRewards() {
    return await this.rewardService.getRewards();
  }

  @UseGuards(JwtAuthGuard)
  @Post('request')
  public async requestPoints(
    @CurrentUser() userId: string,
    @Body() requestPointsDto: RequestPointsDto,
  ) {
    return await this.pointRequestService.request(userId, requestPointsDto);
  }

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
    @CurrentUser() leaderId: string,
    @Param('pointRequestId') pointRequestId: string,
    @Body() approvePointRequestDto: ApprovePointRequestDto,
  ) {
    return await this.pointRequestService.approvePointRequest(
      leaderId,
      pointRequestId,
      approvePointRequestDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':pointRequestId/reject')
  public async rejectRequest(
    @CurrentUser() leaderId: string,
    @Param('pointRequestId') pointRequestId: string,
    @Body() rejectPointRequestDto: RejectPointRequestDto,
  ) {
    return await this.pointRequestService.rejectPointRequest(
      leaderId,
      pointRequestId,
      rejectPointRequestDto,
    );
  }
}
