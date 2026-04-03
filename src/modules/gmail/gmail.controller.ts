import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Redirect,
} from '@nestjs/common';
import { GmailService } from './gmail.service';
import { ProcesarPagoTotalDto } from './dto/gmai.dto';

@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(private readonly gmailService: GmailService) {}

  @Get('auth')
  @Redirect()
  async auth() {
    const url = this.gmailService.getAuthUrl();
    return { url };
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    const tokens = await this.gmailService.getTokens(code);
    return {
      message: '¡Refresh Token obtenido!',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_in: tokens.expiry_date,
    };
  }

  // @Post('webhook')
  // async webhook(@Body() procesarPagoTotalDto: ProcesarPagoTotalDto) {
  //   await this.gmailService.procesarPagoTotal(procesarPagoTotalDto);
  // }
}
