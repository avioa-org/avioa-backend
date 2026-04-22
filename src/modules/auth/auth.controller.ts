import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ValidateAdminGuard } from 'src/common/guards/validate-admin.guard';
import { CreateUserDto } from '../admin/users/dto/register.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('invite/validate')
  public async validateInviteToken(@Query('token') token: string) {
    return await this.authService.validateInviteToken(token);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async inviteUser(@Body() createUserDto: CreateUserDto) {
    return await this.authService.inviteUser(createUserDto);
  }

  @Post('login')
  public async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('invite/accept')
  public async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return await this.authService.acceptInvite(acceptInviteDto);
  }
}
