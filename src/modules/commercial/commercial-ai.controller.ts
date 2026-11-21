// src/modules/commercial/commercial-ai.controller.ts

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { AiQuoteService } from './ai-quote/domain/ai-quote.service';
import { AiQuoteRequestDto } from './ai-quote/domain/ai-quote-request.dto';
import { CommercialEmailService } from './email/commercial-email.service';
import { GoogleSheetClient } from '../flight-blockings/google-sheet.client';
import { Get, Query, BadRequestException  } from "@nestjs/common";

@Controller('commercial')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class CommercialAiController {
  constructor(
    private readonly google: GoogleSheetClient,
    private readonly aiQuote: AiQuoteService,
    private readonly emailService: CommercialEmailService,
  ) {}

  @Post('quotes')
  async quotes(
    @Body() body: AiQuoteRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.aiQuote.quote(userId, body.requestId, body.threadId, body.message);
  }

  @Post('email')
  async email(
    @Body() body: AiQuoteRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.emailService.generateEmail(userId, body.threadId, body.requestId, body.message);
  }

    @Get('offers/raw')
  async getRawOffers(
    @Query('gid') gid: string,
    @Query('range') range: string,
  ) {
    if (!gid || !range) throw new BadRequestException('Faltan parámetros gid y range');
    
    // El backend lee el Excel usando la cuenta de servicio (la llave privada)
    const rows = await this.google.readAuthenticated(Number(gid), range);
    return { rows };
  }

  
}