import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'generated/prisma/enums';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @Roles(Role.EMPLOYEE, Role.LEADER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  getContents(@Query('folderId') folderId?: string) {
    return this.knowledgeService.getContents(folderId);
  }

  @Post('folders')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  createFolder(
    @CurrentUser('userId') userId: string,
    @Body() dto: { name: string; parentId?: string },
  ) {
    return this.knowledgeService.createFolder(userId, dto);
  }

  @Delete('folders/:id')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  deleteFolder(@Param('id') folderId: string) {
    return this.knowledgeService.deleteFolder(folderId);
  }

  @Post('files')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  createFile(
    @CurrentUser('userId') userId: string,
    @Body() dto: { title: string; driveUrl: string; folderId: string },
  ) {
    return this.knowledgeService.createFile(userId, dto);
  }

  @Delete('files/:id')
  @Roles(Role.LEADER, Role.MANAGER, Role.ADMIN)
  deleteFile(@Param('id') fileId: string) {
    return this.knowledgeService.deleteFile(fileId);
  }
}
