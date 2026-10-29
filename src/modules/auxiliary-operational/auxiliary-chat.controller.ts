import {
  Controller,
  Body,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type ICurrentUser,
} from '../../common/decorator/current-user.decorator';
import { RequireModule } from '../../common/decorator/modules-permission.decorator';
import { Modules } from '../../common/enum/modules.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuxiliaryChatQueryDto } from './dto/auxiliary-chat-query.dto';
import { CreateAuxiliaryChatDto } from './dto/create-auxiliary-chat.dto';
import { AuxiliaryChatService } from './auxiliary-chat.service';

@Controller('auxiliary-operational/chat')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.AUXILIARY)
export class AuxiliaryChatController {
  constructor(private readonly service: AuxiliaryChatService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  getStatus(
    @CurrentUser() user: ICurrentUser,
    @Query() query: AuxiliaryChatQueryDto,
  ) {
    return this.service.getStatus(user, query.threadId);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  createReply(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateAuxiliaryChatDto,
  ) {
    return this.service.createReply(user, dto);
  }
}
