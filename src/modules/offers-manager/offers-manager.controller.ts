import { OffersApiFilter } from '../offers-query/offers-api.filter';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { OffersManagerService } from './offers-manager.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { type Response } from 'express';
import {
  CurrentUser,
  type ICurrentUser,
} from 'src/common/decorator/current-user.decorator';

@Controller('offers-manager')
@UseGuards(JwtAuthGuard)
export class OffersManagerController {
  constructor(private readonly offersManagerService: OffersManagerService) {}

  @Get('runtime')
  async runtime(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    res
      .status(200)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .type('text/html; charset=utf-8')
      .send(await this.offersManagerService.getRuntimeHtml(user));
  }

  @Get('hunter/status')
  hunterStatus(@CurrentUser() user: ICurrentUser, @Res() res: Response) { return this.respond(user,'hunter/status','GET','',{},res); }
  @Post('hunter/sync')
  hunterSync(@CurrentUser() user: ICurrentUser, @Body() body: Record<string, unknown>, @Res() res: Response) { return this.respond(user,'hunter/sync','POST','',body||{},res); }

  @Post('simulation/query')
  @UseFilters(OffersApiFilter)
  @HttpCode(200)
  simulationQuery(@CurrentUser() user: ICurrentUser, @Body() body: Record<string, unknown>, @Res() res: Response) { return this.respond(user, 'simulation/query', 'POST', '', body || {}, res); }

  @Get('session')
  async session(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    return this.respond(user, 'session', 'GET', '', {}, res);
  }

  @Get('state')
  async state(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    return this.respond(user, 'state', 'GET', '', {}, res);
  }

  @Put('state')
  @Post('state')
  @HttpCode(200)
  async updateState(
    @CurrentUser() user: ICurrentUser,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    return this.respond(user, 'state', 'PUT', '', body, res);
  }

  @Post('initialize')
  async initialize(
    @CurrentUser() user: ICurrentUser,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    return this.respond(user, 'initialize', 'POST', '', body, res);
  }

  @Get('export-full')
  async exportFull(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    return this.respond(user, 'export-full', 'GET', '', {}, res);
  }

  @Get('history')
  async history(
    @CurrentUser() user: ICurrentUser,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    return this.respond(
      user,
      'history',
      'GET',
      this.toQueryString(query),
      {},
      res,
    );
  }

  @Get('history/:revision')
  async historyEntry(
    @CurrentUser() user: ICurrentUser,
    @Param('revision', ParseIntPipe) revision: number,
    @Res() res: Response,
  ) {
    return this.respond(user, `history/${revision}`, 'GET', '', {}, res);
  }

  @Post('approve')
  @HttpCode(200)
  async approve(
    @CurrentUser() user: ICurrentUser,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    return this.respond(user, 'approve', 'POST', '', body, res);
  }

  @Post('workbook-sync')
  @HttpCode(200)
  async workbookSync(@CurrentUser() user: ICurrentUser, @Res() res: Response) {
    return this.respond(user, 'workbook-sync', 'POST', '', {}, res);
  }

  @Post('product-import/preview')
  @HttpCode(200)
  async productImportPreview(
    @CurrentUser() user: ICurrentUser,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    return this.respond(user, 'product-import/preview', 'POST', '', body, res);
  }

  @Post('product-import/commit')
  @HttpCode(200)
  async productImportCommit(
    @CurrentUser() user: ICurrentUser,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    return this.respond(user, 'product-import/commit', 'POST', '', body, res);
  }

  private async respond(
    user: ICurrentUser,
    path: string,
    method: string,
    query: string,
    body: Record<string, unknown>,
    res: Response,
  ) {
    const result = await this.offersManagerService.dispatch(
      user,
      path,
      method,
      query,
      body,
    );

    res
      .status(result.status)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .type(result.contentType)
      .send(result.body);
  }

  private toQueryString(query: Record<string, string>): string {
    const qs = new URLSearchParams(query).toString();
    return qs ? `?${qs}` : '';
  }
}
