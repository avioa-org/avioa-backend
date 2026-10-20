import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { type Response } from 'express';
import { ConfirmAssistantActionDto } from './dto/confirm-assistant-action.dto';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('actions/confirm')
  confirmAction(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: ConfirmAssistantActionDto,
  ) {
    return this.assistantService.confirmAction(
      user.userId,
      user.role,
      user.isLeader,
      dto.actionId,
      dto.confirmed,
    );
  }

  @Post('stream')
  async chatStream(
    @CurrentUser() user: ICurrentUser,
    @Body('message') message: string,
    @Body('threadId') threadId: string | undefined,
    @Res() res: Response,
  ) {
    return this.assistantService.chatStream(
      user.userId,
      user.role,
      user.isLeader ?? user.role === 'LEADER',
      message,
      res,
      threadId,
    );
  }

  @Post()
  async chat(
    @CurrentUser() user: ICurrentUser,
    @Body('message') message: string,
    @Body('threadId') threadId?: string,
  ) {
    return this.assistantService.chat(
      user.userId,
      user.role,
      user.isLeader ?? user.role === 'LEADER',
      message,
      threadId,
    );
  }
}
