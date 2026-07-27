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

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  create(@Body() dto: CreateLeaveDto, @CurrentUser('userId') userId: string) {
    return this.leavesService.create(userId, dto);
  }

  @Get('my')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  findMyRequests(
    @CurrentUser('userId') userId: string,
    @Query() query: LeaveQueryDto,
  ) {
    return this.leavesService.findMyRequests(userId, query);
  }

  @Get('my/balance')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  getMyBalance(@CurrentUser('userId') userId: string) {
    return this.leavesService.getMyBalance(userId);
  }

  @Get('team')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  findTeamRequests(
    @CurrentUser('userId') userId: string,
    @Query() query: LeaveQueryDto,
  ) {
    return this.leavesService.findTeamRequests(userId, query);
  }

  @Get(':id')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.leavesService.findOne(id, userId);
  }

  @Patch(':id/review')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @UseGuards(LeaveLeaderGuard)
  review(@Req() req, @Body() dto: ReviewLeaveDto) {
    return this.leavesService.review(req.leaveRecord, dto);
  }

  @Delete(':id')
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  cancel(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.leavesService.cancel(id, userId);
  }
}
