import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../../common/enum/roles.enum';
import {
  CurrentUser,
  type ICurrentUser,
} from '../../common/decorator/current-user.decorator';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  //CREAR SOLICITUD (cualquier usuario autenticado)
  @Post()
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateMaintenanceDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  // MIS SOLICITUDES
  @Get('my')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findMyRequests(@CurrentUser() user: ICurrentUser) {
    return this.service.findMyRequests(user.userId);
  }

  //TODAS (solo soporte + líderes + admin)
  @Get()
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.service.findAll(query);
  }

  // VER UNA
  @Get(':id')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  //  ACTUALIZAR ESTADO (solo soporte + líderes + admin) 
  @Patch(':id/status')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.updateStatus(id, dto, user.userId);
  }

  // CANCELAR (solo el creador)
  @Patch(':id/cancel')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.service.cancel(id, user.userId);
  }
}