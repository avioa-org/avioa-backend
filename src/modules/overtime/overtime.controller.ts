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
import { Roles } from '../auth/decorator/roles.decorator';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'generated/prisma/enums';
import { OvertimeLeaderGuard } from './overtime-leader.guard.';

@Controller('overtime')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Post()
  @Roles(Role.EMPLOYEE, Role.ADMIN)
  create(@Body() dto: CreateOvertimeDto, @CurrentUser() user: ICurrentUser) {
    return this.overtimeService.create(user.userId, dto);
  }

  @Get('my')
  @Roles(Role.EMPLOYEE, Role.ADMIN)
  findMyRequests(
    @CurrentUser() user: ICurrentUser,
    @Query() query: OvertimeQueryDto,
  ) {
    return this.overtimeService.findMyRequests(user.userId, query);
  }

  @Get('team')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  findTeamRequests(
    @CurrentUser() user: ICurrentUser,
    @Query() query: OvertimeQueryDto,
  ) {
    return this.overtimeService.findTeamRequests(user.userId, query);
  }

  @Get('summary')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  getSummary(
    @Query() query: OvertimeQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.overtimeService.getSummary(user.userId, user.role, query);
  }

  @Get(':id')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.overtimeService.findOne(id, user.userId);
  }

  @Patch(':id/review')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  @UseGuards(OvertimeLeaderGuard)
  review(@Req() req, @Body() dto: ReviewOvertimeDto) {
    // req.overtimeRecord viene del OvertimeLeaderGuard
    return this.overtimeService.review(req.overtimeRecord, dto);
  }
}
