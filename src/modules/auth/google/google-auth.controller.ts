import {
  Controller,
  Get,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { type Response, type Request } from 'express';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  public async connect(@CurrentUser() user: ICurrentUser) {
    const userId = user.userId;
    const url = await this.googleAuthService.generateAuthUrl(userId);
    return { url };
  }

  @Get('callback')
  public async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    const tokens = await this.googleAuthService.getTokensFromCode(code, userId);
    console.log('Received tokens:', tokens);
    return res.redirect(`${process.env.FRONTEND_URL}/profile?google=connected`);
  }
}
