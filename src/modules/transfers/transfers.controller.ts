import {
  Body,
  Delete,
  Query,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  CurrentUser,
  type ICurrentUser,
} from '../../common/decorator/current-user.decorator';
import {
  RequireAction,
  RequireModule,
} from '../../common/decorator/modules-permission.decorator';
import { Modules } from '../../common/enum/modules.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { CreateTransferRequestDto } from './create-transfer-request.dto';
import { TransfersService } from './transfers.service';
import { UpsertTransferProviderDto } from './upsert-transfer-provider.dto';
import { TransfersMessagingService } from './transfers-messaging.service';
import { Public } from '../../common/decorator/public.decorator';
import type { Response } from 'express';
import { envs } from '../../config/env.config';

@Controller('transfers')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class TransfersController {
  constructor(
    private readonly service: TransfersService,
    private readonly messaging: TransfersMessagingService,
  ) {}

  @Get('requests/my')
  listMine(@CurrentUser() user: ICurrentUser) {
    return this.service.listMine(user.userId);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateTransferRequestDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  @Get('requests/:id')
  findMineById(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.service.findMineById(user.userId, id);
  }

  @Patch('requests/:id')
  updateMine(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body()
    dto: { payload: Record<string, unknown>; status: string; version: number },
  ) {
    return this.service.updateMine(user.userId, id, dto);
  }

  @Patch('requests/:id/cancel')
  cancelMine(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.service.cancelMine(user.userId, id);
  }

  @Get('providers')
  listActiveProviders() {
    return this.service.listActiveProviders();
  }

  @Get('admin/providers')
  @RequireModule(Modules.TRANSFERS_PROVIDERS)
  listProviders() {
    return this.service.listProviders();
  }

  @Post('admin/providers')
  @RequireModule(Modules.TRANSFERS_PROVIDERS)
  @RequireAction('create')
  @HttpCode(HttpStatus.CREATED)
  createProvider(@Body() dto: UpsertTransferProviderDto) {
    return this.service.createProvider(dto);
  }

  @Put('admin/providers/:id')
  @RequireModule(Modules.TRANSFERS_PROVIDERS)
  @RequireAction('update')
  updateProvider(
    @Param('id') id: string,
    @Body() dto: UpsertTransferProviderDto,
  ) {
    return this.service.updateProvider(id, dto);
  }
  @Get('gmail/connection')
  gmailConnection(@CurrentUser() user: ICurrentUser) {
    return this.messaging.gmailStatus(user.userId);
  }
  @Get('gmail/connect')
  connectGmail(
    @CurrentUser() user: ICurrentUser,
    @Query('returnTo') returnTo?: string,
  ) {
    return this.messaging.startGmail(user.userId, returnTo);
  }
  @Get('gmail/callback')
  @Public()
  async gmailCallback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const returnTo = await this.messaging.gmailReturnTo(state);
    let status = 'error';
    if (error) {
      await this.messaging.cancelGmail(state);
      status = 'cancelled';
    } else {
      try {
        await this.messaging.finishGmail(state, code);
        status = 'connected';
      } catch {
        status = 'error';
      }
    }
    const destination = new URL(returnTo, envs.FRONTEND_URL);
    destination.searchParams.set(
      returnTo === '/profile' ? 'google' : 'gmail',
      status,
    );
    return response.redirect(303, destination.toString());
  }
  @Delete('gmail/connection')
  disconnectGmail(@CurrentUser() user: ICurrentUser) {
    return this.messaging.disconnectGmail(user.userId);
  }
  @Get('evolution/connection')
  evolutionConnection() {
    return this.messaging.evolutionStatus();
  }
  @Get('requests/:id/email')
  emailPreview(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.messaging.emailPreview(user.userId, id);
  }
  @Post('requests/:id/email')
  sendEmail(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() body: { version: number; previewHash: string; retry?: boolean },
  ) {
    return this.messaging.sendEmail(user.userId, id, body);
  }
  @Get('requests/:id/whatsapp')
  whatsappPreview(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    return this.messaging.whatsappPreview(user.userId, id);
  }
  @Post('requests/:id/whatsapp')
  sendWhatsApp(
    @CurrentUser() user: ICurrentUser,
    @Param('id') id: string,
    @Body() body: { version: number; previewHash: string; retry?: boolean },
  ) {
    return this.messaging.sendWhatsApp(user.userId, id, body);
  }
  @Get('admin/connections')
  @RequireModule(Modules.TRANSFERS_CONNECTIONS)
  async connectionsStatus(@CurrentUser() user: ICurrentUser) {
    const [gmail, evolution] = await Promise.all([
      this.messaging.gmailStatus(user.userId),
      this.messaging.evolutionStatus(),
    ]);
    return { gmail, evolution };
  }
}
