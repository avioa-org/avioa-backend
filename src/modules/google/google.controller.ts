import { Controller, Get, Query } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('redirect')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    console.log(code);
    return await this.googleService.getToken(code);
  }

  @Get('auth')
  async getGoogleAuthUrl() {
    return await this.googleService.getGoogleAuthUrl();
  }

  // @Get('subjects')
  // async getSubjects() {
  //   return await this.googleService.getSubjects();
  // }
}
