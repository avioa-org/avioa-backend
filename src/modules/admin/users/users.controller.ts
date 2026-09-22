import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/register.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { SetUserModulesDto } from './dto/set-user-modules.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =========================================================
  // RUTAS ESTÁTICAS
  // =========================================================

  @Post()
  @RequireModule(Modules.USERS_ADMIN)
  public async register(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.inviteUser(createUserDto);
  }

  @Get()
  @RequireModule(Modules.USERS_ADMIN)
  public async getAllUsers() {
    return await this.usersService.getAllUsers();
  }

  @Get('directory')
  public async getUserDirectory(@CurrentUser('userId') userId: string) {
    return await this.usersService.getUserDirectory(userId);
  }

  @Get('leaders')
  public async getLeaders() {
    return await this.usersService.getLeaders();
  }

  @Get('search')
  search(@Query('q') q: string, @CurrentUser('userId') userId: string) {
    return this.usersService.searchUser(q, userId);
  }

  @Get('leaders-db')
  public async getLeadersDb() {
    return await this.usersService.getLeadersDb();
  }

  @Patch('update-profile')
  @FormDataRequest()
  public async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return await this.usersService.updateProfile(updateProfileDto, user.userId);
  }

  @Post(':userId/resend-invite')
  @RequireModule(Modules.USERS_ADMIN)
  public async resendInvite(@Param('userId') userId: string) {
    return await this.usersService.resendInvite(userId);
  }

  @Get(':userId/permissions')
  @RequireModule(Modules.USERS_ADMIN)
  public async getUserPermissions(@Param('userId') userId: string) {
    return await this.usersService.getUserPermissions(userId);
  }

  @Put(':userId/permissions')
  @RequireModule(Modules.USERS_ADMIN)
  public async updateUserPermissions(
    @Param('userId') userId: string,
    @Body() setUserModulesDto: SetUserModulesDto,
    @CurrentUser('userId') grantedBy: string,
  ) {
    return await this.usersService.updateUserPermissions(
      userId,
      setUserModulesDto,
      grantedBy,
    );
  }

  @Patch(':userId')
  @RequireModule(Modules.USERS_ADMIN)
  public async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(userId, updateUserDto);
  }

  @Delete(':userId')
  @RequireModule(Modules.USERS_ADMIN)
  public async deleteUser(@Param('userId') userId: string) {
    return await this.usersService.deleteUser(userId);
  }
}
