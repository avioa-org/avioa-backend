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

@Controller('equipment-loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentLoansController {
  constructor(private readonly service: EquipmentLoansService) {}

  // ========== EQUIPOS ==========

  @Post('equipment')
  @Roles(Role.ADMIN, Role.LEADER)
  @HttpCode(HttpStatus.CREATED)
  createEquipment(@Body() dto: EquipmentDto) {
    return this.service.createEquipment(dto);
  }

  @Get('equipment')
  @Public()
  @HttpCode(HttpStatus.OK)
  findAllEquipment() {
    return this.service.findAllEquipment();
  }

  @Get('equipment/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  findOneEquipment(@Param('id') id: string) {
    return this.service.findOneEquipment(id);
  }

  @Put('equipment/:id')
  @Roles(Role.ADMIN, Role.LEADER)
  @HttpCode(HttpStatus.OK)
  updateEquipment(@Param('id') id: string, @Body() dto: EquipmentDto) {
    return this.service.updateEquipment(id, dto);
  }

  @Delete('equipment/:id')
  @Roles(Role.ADMIN, Role.LEADER)
  @HttpCode(HttpStatus.OK)
  deleteEquipment(@Param('id') id: string) {
    return this.service.deleteEquipment(id);
  }

  // ========== PRÉSTAMOS ==========

  @Post('loans')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createLoan(@CurrentUser() user: ICurrentUser, @Body() dto: LoanDto) {
    return this.service.createLoan(user.userId, dto);
  }

  @Get('loans/my')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findMyLoans(@CurrentUser() user: ICurrentUser) {
    return this.service.findMyLoans(user.userId);
  }

  @Get('loans')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findAllLoans(
    @Query('status') status?: LoanStatus,
    @Query('userId') userId?: string,
    @Query('equipmentId') equipmentId?: string,
  ) {
    return this.service.findAllLoans({ status, userId, equipmentId });
  }

  @Get('loans/:id')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findOneLoan(@Param('id') id: string) {
    return this.service.findOneLoan(id);
  }

  @Patch('loans/:id/status')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  updateLoanStatus(
    @Param('id') id: string,
    @Body('status') status: LoanStatus,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.updateLoanStatus(id, status, user.userId);
  }

  @Patch('loans/:id/cancel')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
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
}
