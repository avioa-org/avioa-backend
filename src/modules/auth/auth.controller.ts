import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ValidateAdminGuard } from 'src/common/guards/validate-admin.guard';
import { CreateUserDto } from '../admin/users/dto/register.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import {
  ForgotPasswordDto,
  ForgotPasswordSendDto,
} from './dto/forgot-password';
import { Public } from 'src/common/decorator/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';

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

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  public async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser('userId') userId: string) {
    return this.authService.logout(userId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('invite/accept')
  public async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return await this.authService.acceptInvite(acceptInviteDto);
  }

  @Post('forgot-password/send')
  public async forgotPasswordSend(
    @Body() forgotPasswordSendDto: ForgotPasswordSendDto,
  ) {
    return await this.authService.forgotPasswordSend(forgotPasswordSendDto);
  }

  @Patch('forgot-password')
  public async forgotPassword(@Body() forgotPassword: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPassword);
  }
}
