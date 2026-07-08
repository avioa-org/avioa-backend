import {
  Body,
  Controller,
  Delete,
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
import { FormDataRequest } from 'nestjs-form-data';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';

@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  //@UseGuards(JwtAuthGuard, ValidateAdminGuard)//
  public async register(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.inviteUser(createUserDto);
  }

  @Post(':userId/resend-invite')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async resendInvite(@Param('userId') userId: string) {
    return await this.usersService.resendInvite(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async getAllUsers() {
    return await this.usersService.getAllUsers();
  }

  @Get('leaders')
  @UseGuards(JwtAuthGuard)
  public async getLeaders() {
    return await this.usersService.getLeaders();
  }

  @Patch('update-profile')
  @UseGuards(JwtAuthGuard)
  @FormDataRequest()
  public async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return await this.usersService.updateProfile(updateProfileDto, user.userId);
  }

  @Patch('/:userId')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(userId, updateUserDto);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard, ValidateAdminGuard)
  public async deleteUser(@Param('userId') userId: string) {
    return await this.usersService.deleteUser(userId);
  }
}
