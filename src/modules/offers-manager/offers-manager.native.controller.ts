import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OffersManagerNativeService } from './offers-manager.native.service';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';
import { SaveOffersStateDto } from './dto/save-offers-state.dto';

@Controller('offers-manager/native')
@UseGuards(JwtAuthGuard)
export class OffersManagerNativeController {
  constructor(private readonly nativeService: OffersManagerNativeService) {}

  @Get('session')
  session(@CurrentUser() user: ICurrentUser) {
    return this.nativeService.getSession(user);
  }

  @Get('state')
  state(@CurrentUser() user: ICurrentUser) {
    return this.nativeService.getSnapshot(user);
  }

  @Put('state')
  saveState(
    @CurrentUser() user: ICurrentUser,
    @Body() body: SaveOffersStateDto,
  ) {
    return this.nativeService.saveSnapshot(user, body);
  }

  @Get('history')
  history(@CurrentUser() user: ICurrentUser) {
    return this.nativeService.getHistory(user);
  }

  @Get('history/:revision')
  historyRevision(
    @CurrentUser() user: ICurrentUser,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.nativeService.getHistoryRevision(user, revision);
  }
}
