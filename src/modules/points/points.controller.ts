import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { RequestPointsDto } from './dto/request-points';
import { ApprovePointRequestDto } from './dto/approve-point-request.dto';
import { RejectPointRequestDto } from './dto/reject-point-request.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('points')
@UseGuards(JwtAuthGuard) // auth global
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly pointRequestService: PointRequestService,
    private readonly pointWalletService: PointWalletService,
    private readonly pointTransactionService: PointTransactionService,
    private readonly rewardService: RewardService,
  ) {}

  // ========== USUARIO (autenticado) ==========

  @Get('my-requests')
  public async getMyRequests(@CurrentUser() user: ICurrentUser) {
    return await this.pointRequestService.getMyRequests(user.userId);
  }

  @Get('wallet')
  public async getWallet(@CurrentUser() user: ICurrentUser) {
    return await this.pointWalletService.getWallet(user.userId);
  }

  @Get('history')
  public async getHistory(@CurrentUser() user: ICurrentUser) {
    return await this.pointTransactionService.getHistory(user.userId);
  }

  @Get('rewards')
  public async getRewards() {
    return await this.rewardService.getRewards();
  }

  @Post('request')
  public async requestPoints(
    @CurrentUser() user: ICurrentUser,
    @Body() requestPointsDto: RequestPointsDto,
  ) {
    return await this.pointRequestService.request(
      user.userId,
      requestPointsDto,
    );
  }

  // ========== LÍDERES (aprobar/rechazar) ==========

  @Get('pending')
  public async getPendingRequests(@CurrentUser() user: ICurrentUser) {
    return await this.pointRequestService.getPendingRequests(user.userId);
  }

  @Get('pending/:pointRequestId')
  public async getPendingRequest(
    @CurrentUser() user: ICurrentUser,
    @Param('pointRequestId') pointRequestId: string,
  ) {
    return await this.pointRequestService.getPendingRequest(
      user.userId,
      pointRequestId,
    );
  }

  @Patch(':pointRequestId/approve')
  public async approveRequest(
    @CurrentUser() user: ICurrentUser,
    @Param('pointRequestId') pointRequestId: string,
    @Body() approvePointRequestDto: ApprovePointRequestDto,
  ) {
    return await this.pointRequestService.approvePointRequest(
      user.userId,
      pointRequestId,
      approvePointRequestDto,
    );
  }

  @Patch(':pointRequestId/reject')
  public async rejectRequest(
    @CurrentUser() user: ICurrentUser,
    @Param('pointRequestId') pointRequestId: string,
    @Body() rejectPointRequestDto: RejectPointRequestDto,
  ) {
    return await this.pointRequestService.rejectPointRequest(
      user.userId,
      pointRequestId,
      rejectPointRequestDto,
    );
  }

  // ========== ADMIN (gestión de recompensas) ==========

  @Post('reward/create')
  @RequireModule(Modules.POINTS, Modules.USERS_ADMIN_REWARDS)
  @UseGuards(ModulePermissionGuard)
  public async createReward(@Body() createRewardDto: CreateRewardDto) {
    return await this.rewardService.createReward(createRewardDto);
  }

  @Post('rewards/create/bulk')
  @RequireModule(Modules.POINTS, Modules.USERS_ADMIN_REWARDS)
  @UseGuards(ModulePermissionGuard)
  @FormDataRequest()
  public async createBulkRewards(
    @Body() rewards: CreateBulkRewardDto,
    @Req() req: any,
  ) {
    let parsedData: CreateRewardDto[];
    try {
      parsedData =
        typeof rewards.data === 'string'
          ? JSON.parse(rewards.data)
          : rewards.data;
    } catch {
      throw new BadRequestException('El campo data no es un JSON válido');
    }

    const files = !rewards.files
      ? []
      : Array.isArray(rewards.files)
        ? rewards.files
        : [rewards.files];

    return await this.rewardService.createBulkRewards(parsedData, files);
  }

  @Delete('rewards/delete/:rewardId')
  @RequireModule(Modules.POINTS, Modules.USERS_ADMIN_REWARDS)
  @UseGuards(ModulePermissionGuard)
  public async deleteReward(@Param('rewardId') rewardId: string) {
    return await this.rewardService.deleteReward(rewardId);
  }
}
