import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EquipmentLoansService } from './equipment-loans.service';
import { EquipmentDto } from './dto/equipment.dto';
import { LoanDto, LoanStatus } from './dto/loan.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/common/enum/roles.enum';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { Public } from 'src/common/decorator/public.decorator';
import { CreateLocationDto } from './dto/location.dto';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule, RequireAction } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('equipment-loans')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class EquipmentLoansController {
  constructor(private readonly service: EquipmentLoansService) {}

  // ========== EQUIPOS ==========

  @Post('equipment')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @RequireAction('create')
  @HttpCode(HttpStatus.CREATED)
  createEquipment(@Body() dto: EquipmentDto) {
    return this.service.createEquipment(dto);
  }

  @Get('equipment')
  @HttpCode(HttpStatus.OK)
  findAllEquipment(@CurrentUser() user: ICurrentUser) {
    return this.service.findAllEquipment({
      userId: user.userId,
      role: user.role,
      isLeader: user.isLeader,
    });
  }

  @Get('equipment/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  findOneEquipment(@Param('id') id: string) {
    return this.service.findOneEquipment(id);
  }

  @Put('equipment/:id')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @RequireAction('update')
  @HttpCode(HttpStatus.OK)
  updateEquipment(@Param('id') id: string, @Body() dto: EquipmentDto) {
    return this.service.updateEquipment(id, dto);
  }

  @Delete('equipment/:id')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @RequireAction('delete')
  @HttpCode(HttpStatus.OK)
  deleteEquipment(@Param('id') id: string) {
    return this.service.deleteEquipment(id);
  }

  // ========== PRÉSTAMOS ==========

  @Post('loans')
  @HttpCode(HttpStatus.CREATED)
  createLoan(@CurrentUser() user: ICurrentUser, @Body() dto: LoanDto) {
    return this.service.createLoan(user.userId, dto);
  }

  @Get('loans/my')
  @HttpCode(HttpStatus.OK)
  findMyLoans(@CurrentUser() user: ICurrentUser) {
    return this.service.findMyLoans(user.userId);
  }

  @Get('loans')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @HttpCode(HttpStatus.OK)
  findAllLoans(
    @Query('status') status?: LoanStatus,
    @Query('userId') userId?: string,
    @Query('equipmentId') equipmentId?: string,
  ) {
    return this.service.findAllLoans({ status, userId, equipmentId });
  }

  @Get('loans/:id')
  @HttpCode(HttpStatus.OK)
  findOneLoan(@Param('id') id: string) {
    return this.service.findOneLoan(id);
  }

  @Patch('loans/:id/status')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @RequireAction('update')
  @HttpCode(HttpStatus.OK)
  updateLoanStatus(
    @Param('id') id: string,
    @Body('status') status: LoanStatus,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.updateLoanStatus(id, status, user.userId);
  }

  @Patch('loans/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelLoan(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.service.cancelLoan(id, user.userId);
  }

  // ========== UBICACIONES ==========

  @Get('locations')
  @Public()
  @HttpCode(HttpStatus.OK)
  findAllLocations() {
    return this.service.findAllLocations();
  }

  @Post('locations')
  @RequireModule(Modules.EQUIPMENT_LOANS)
  @RequireAction('create')
  @HttpCode(HttpStatus.CREATED)
  async createLocation(@Body() dto: CreateLocationDto[]) {
    return await this.service.createLocation(dto);
  }
}
