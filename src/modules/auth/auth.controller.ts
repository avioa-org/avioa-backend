import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ValidateAdminGuard } from 'src/common/guards/validate-admin.guard';
import { CreateUserDto } from '../admin/users/dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('invite')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async inviteUser(@Body() createUserDto: CreateUserDto) {
    return await this.authService.inviteUser(createUserDto);
  }

  @Post('login')
  public async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }
}
