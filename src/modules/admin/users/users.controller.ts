import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ValidateAdminGuard } from 'src/common/guards/validate-admin.guard';
// import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/register.dto';

@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async register(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.inviteUser(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async getAllUsers() {
    return await this.usersService.getAllUsers();
  }

  @Patch('/:userId')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(userId, updateUserDto);
  }
}
