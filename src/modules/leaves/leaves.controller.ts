import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'generated/prisma/enums';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { LeaveLeaderGuard } from './guards/leave-leader.guard';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { UpdateVacationAdjustmentDto } from './dto/update-vacation-adjustment.dto';
import { BulkMigrateVacationsDto } from './dto/bulk-migration-vacations.dto';
import { Public } from 'src/common/decorator/public.decorator';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { ValidateCompensatedLeaveDto } from './dto/validate-compensated-leave.dto';

@Controller('leaves')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // ========== USUARIO ==========

  @Post()
  create(@Body() dto: CreateLeaveDto, @CurrentUser('userId') userId: string) {
    return this.leavesService.create(userId, dto);
  }

  @Get('my')
  findMyRequests(
    @CurrentUser('userId') userId: string,
    @Query() query: LeaveQueryDto,
  ) {
    return this.leavesService.findMyRequests(userId, query);
  }

  @Get('my/balance')
  getMyBalance(@CurrentUser('userId') userId: string) {
    return this.leavesService.getMyBalance(userId);
  }

  // ========== LÍDER ==========

  @Get('team')
  @RequireModule(Modules.LEAVES)
  findTeamRequests(
    @CurrentUser('userId') userId: string,
    @Query() query: LeaveQueryDto,
  ) {
    return this.leavesService.findTeamRequests(userId, query);
  }

  @Get('pending-hr-validation')
  @RequireModule(Modules.LEAVES_HR_VALIDATION)
  findPendingHRValidation() {
    return this.leavesService.findPendingHRValidation();
  }

  @Get('hr-validation/:id')
  @RequireModule(Modules.LEAVES_HR_VALIDATION)
  findOneForHR(@Param('id') id: string) {
    return this.leavesService.findOneForHR(id);
  }

  @Patch(':id/review')
  @RequireModule(Modules.LEAVES)
  @UseGuards(LeaveLeaderGuard)
  review(@Req() req, @Body() dto: ReviewLeaveDto) {
    return this.leavesService.review(req.leaveRecord, dto);
  }

  // ========== RRHH ==========

  @Patch(':id/validate-hr')
  @RequireModule(Modules.LEAVES_HR_VALIDATION)
  validateByHR(
    @Param('id') id: string,
    @Body() dto: ValidateCompensatedLeaveDto,
    @CurrentUser('userId') hrUserId: string,
  ) {
    return this.leavesService.validateByHR(id, hrUserId, dto);
  }

  // ========== ADMIN / RRHH ==========

  @Get('admin/balances')
  @RequireModule(Modules.LEAVES, Modules.USERS_ADMIN_VACATIONS)
  getAllEmployeeBalances() {
    return this.leavesService.getAllEmployeeBalances();
  }

  @Patch('admin/adjustment/:userId')
  @RequireModule(Modules.LEAVES, Modules.USERS_ADMIN_VACATIONS)
  updateUserVacationAdjustment(
    @Param('userId') userId: string,
    @Body() dto: UpdateVacationAdjustmentDto,
  ) {
    return this.leavesService.updateUserVacationAdjustment(
      userId,
      dto.vacationDaysAdjustment,
    );
  }

  // ========== MIGRACIÓN ==========

  @Post('bulk-migrate-historical')
  @Public()
  async bulkMigrateVacations(@Body() dto: BulkMigrateVacationsDto) {
    return await this.leavesService.bulkMigrate(dto);
  }

  // ========== RUTAS DINÁMICAS: SIEMPRE AL FINAL ==========

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.leavesService.findOne(id, userId);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.leavesService.cancel(id, userId);
  }
}
