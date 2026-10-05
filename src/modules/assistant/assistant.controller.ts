import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { type Response } from 'express';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('stream')
  async chatStream(
    @CurrentUser() user: ICurrentUser,
    @Body('message') message: string,
    @Res() res: Response,
  ) {
    return this.assistantService.chatStream(
      user.userId,
      user.role,
      user.isLeader ?? user.role === 'LEADER',
      message,
      res,
    );
  }

  @Post()
  async chat(
    @CurrentUser() user: ICurrentUser,
    @Body('message') message: string,
  ) {
    return this.assistantService.chat(
      user.userId,
      user.role,
      user.isLeader ?? user.role === 'LEADER',
      message,
    );
  }
}
