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
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { Modules } from 'src/common/enum/modules.enum';
import {
  RequireModule,
  RequireAction,
} from 'src/common/decorator/modules-permission.decorator';

@Controller('knowledge')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getContents(@Query('folderId') folderId?: string) {
    return this.knowledgeService.getContents(folderId);
  }

  @Post('folders')
  @RequireModule(Modules.KNOWLEDGE)
  @RequireAction('create')
  createFolder(
    @CurrentUser('userId') userId: string,
    @Body() dto: { name: string; parentId?: string },
  ) {
    return this.knowledgeService.createFolder(userId, dto);
  }

  @Delete('folders/:id')
  @RequireModule(Modules.KNOWLEDGE)
  @RequireAction('delete')
  deleteFolder(@Param('id') folderId: string) {
    return this.knowledgeService.deleteFolder(folderId);
  }

  @Post('files')
  @RequireModule(Modules.KNOWLEDGE)
  @RequireAction('create')
  createFile(
    @CurrentUser('userId') userId: string,
    @Body() dto: { title: string; driveUrl: string; folderId: string },
  ) {
    return this.knowledgeService.createFile(userId, dto);
  }

  @Delete('files/:id')
  @RequireModule(Modules.KNOWLEDGE)
  @RequireAction('delete')
  deleteFile(@Param('id') fileId: string) {
    return this.knowledgeService.deleteFile(fileId);
  }
}
