import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TutorialService } from './tutorial.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('tutorial')
@UseGuards(JwtAuthGuard)
export class TutorialController {
  constructor(private readonly tutorialService: TutorialService) {}

  @Get()
  findAll() {
    return this.tutorialService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.tutorialService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tutorialService.remove(id);
  }
}
