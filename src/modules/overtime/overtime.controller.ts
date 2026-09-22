import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { ReviewOvertimeDto } from './dto/review-overtime.dto';
import { OvertimeQueryDto } from './dto/overtime-query.dto';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OvertimeLeaderGuard } from './overtime-leader.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@Controller('overtime')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  // CREAR — cualquier autenticado crea su propia solicitud
  @Post()
  create(@Body() dto: CreateOvertimeDto, @CurrentUser() user: ICurrentUser) {
    return this.overtimeService.create(user.userId, dto);
  }

  // MIS SOLICITUDES — cualquier autenticado
  @Get('my')
  findMyRequests(
    @CurrentUser() user: ICurrentUser,
    @Query() query: OvertimeQueryDto,
  ) {
    return this.overtimeService.findMyRequests(user.userId, query);
  }

  // EQUIPO — requiere módulo OVERTIME (o ADMIN)
  @Get('team')
  @RequireModule(Modules.OVERTIME)
  findTeamRequests(
    @CurrentUser() user: ICurrentUser,
    @Query() query: OvertimeQueryDto,
  ) {
    return this.overtimeService.findTeamRequests(user.userId, query);
  }

  // RESUMEN — cualquier autenticado; el service acota por rol/scope
  @Get('summary')
  getSummary(
    @Query() query: OvertimeQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.overtimeService.getSummary(user.userId, user.role, query);
  }

  // VER UNA — cualquier autenticado; el service valida propiedad/acceso
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.overtimeService.findOne(id, user.userId);
  }

  // REVISAR — requiere módulo OVERTIME + ser líder del equipo (guard de negocio)
  @Patch(':id/review')
  @RequireModule(Modules.OVERTIME)
  @UseGuards(OvertimeLeaderGuard)
  review(@Req() req, @Body() dto: ReviewOvertimeDto) {
    return this.overtimeService.review(req.overtimeRecord, dto);
  }
}
