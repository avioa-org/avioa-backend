import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post()
  async chat(
    @CurrentUser('userId') userId: string,
    @Body('message') message: string,
  ) {
    return this.assistantService.chat(userId, message);
  }
}
