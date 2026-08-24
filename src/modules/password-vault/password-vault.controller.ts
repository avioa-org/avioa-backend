import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Headers,
  Delete,
} from '@nestjs/common';
import { PasswordVaultService } from './password-vault.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreatePasswordDto } from './dto/create-password.dto';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { SearchPasswordVaultDto } from './dto/search-password-vault.dto';
import express from 'express';
import { GeneratePasswordDto } from './dto/generate-password.dto';
import { ShareVaultDto, UpdatePermissionDto } from './dto/share-vault.dto';
import { RevealPasswordDto } from './dto/reveal-password.dto';
import { VaultDashboardService } from './vault-dasboard.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';

@Controller('password-vault')
@UseGuards(JwtAuthGuard)
export class PasswordVaultController {
  constructor(
    private readonly passwordVaultService: PasswordVaultService,
    private readonly vaultDashboardService: VaultDashboardService,
  ) {}

  @Post('create')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(
    @Body() dto: CreatePasswordDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.create(userId, dto);
  }

  @Patch('update/:vaultId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async update(
    @Body() dto: UpdatePasswordDto,
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.update(userId, vaultId, dto);
  }

  @Patch('soft-delete/:vaultId')
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async softDelete(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.softDelete(userId, vaultId);
  }

  @Patch('restore/:vaultId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async restore(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.restore(userId, vaultId);
  }

  @Patch('toggle-favorite/:vaultId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async toggleFavorite(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.toggleFavorite(userId, vaultId);
  }

  @Patch('permissions/:permissionId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async updatePermission(
    @CurrentUser('userId') userId: string,
    @Param('permissionId') permissionId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.passwordVaultService.updatePermission(
      userId,
      permissionId,
      dto,
    );
  }

  @Patch('category/update/:categoryId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async updateCategory(
    @Body() dto: UpdateCategoryDto,
    @Param('categoryId') categoryId: string,
  ) {
    return this.passwordVaultService.updateCategory(categoryId, dto);
  }

  @Get('find-all')
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: SearchPasswordVaultDto,
  ) {
    return await this.passwordVaultService.findAll(userId, query);
  }

  @Get('list-shared/:vaultId')
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async listShared(@Param('vaultId') vaultId: string) {
    const result = await this.passwordVaultService.listSharedWith(vaultId);
    return result;
  }

  @Get('dashboard')
  async dashboard(@CurrentUser('userId') userId: string) {
    return await this.vaultDashboardService.getSummary(userId);
  }

  @Get('category')
  async getCategories() {
    return await this.passwordVaultService.findAllCategories();
  }

  @Get('tag')
  async getTags() {
    return await this.passwordVaultService.findAllTags();
  }

  @Get('trash')
  @UseGuards(JwtAuthGuard)
  async findTrash(@CurrentUser('userId') userId: string) {
    return await this.passwordVaultService.findTrash(userId);
  }

  @Post('restore/:vaultId')
  async restoreVault(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.restore(userId, vaultId);
  }

  @Post('reveal/:vaultId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async reveal(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() dto: RevealPasswordDto,
  ) {
    const meta = {
      ip,
      userAgent,
    };

    return await this.passwordVaultService.reveal(userId, vaultId, dto, meta);
  }

  @Post('log-copy/:vaultId')
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async logCopy(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
    // @Ip() ip: string,
    @Headers('x-original-user-agent') userAgent: string,
    @Headers('x-original-ip') ip: string,
    @Req() req: express.Request,
    @Body() dto: { field: 'USERNAME' | 'PASSWORD' },
  ) {
    const meta = {
      ip,
      userAgent,
    };

    return await this.passwordVaultService.logCopy(
      userId,
      vaultId,
      dto.field,
      meta,
    );
  }

  @Post('generate-password')
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  generate(@Body() dto: GeneratePasswordDto) {
    return { password: this.passwordVaultService.generate(dto) };
  }

  @Post('sharing/:vaultId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async share(
    @CurrentUser('userId') user: string,
    @Param('vaultId') vaultId: string,
    @Body() dto: ShareVaultDto,
  ) {
    return await this.passwordVaultService.share(user, vaultId, dto);
  }

  @Post('category/create')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return await this.passwordVaultService.createCategory(dto);
  }

  @Post('tag/create')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createTag(@Body() dto: CreateTagDto) {
    return await this.passwordVaultService.findOrCreateTag(dto);
  }

  @Delete('permissions/:permissionId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async revoke(
    @CurrentUser('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return await this.passwordVaultService.revoke(userId, permissionId);
  }

  @Delete('category/:categoryId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async deleteCategory(@Param('categoryId') categoryId: string) {
    return await this.passwordVaultService.deleteCategory(categoryId);
  }

  @Delete('tag/:tagId')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async deleteTag(@Param('tagId') tagId: string) {
    return await this.passwordVaultService.deleteTag(tagId);
  }

  @Delete('permanent/:vaultId')
  @UseGuards(JwtAuthGuard)
  async permanentDelete(
    @Param('vaultId') vaultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.passwordVaultService.permanentDelete(userId, vaultId);
  }
}
