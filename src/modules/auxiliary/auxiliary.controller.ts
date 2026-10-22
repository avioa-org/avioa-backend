import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuxiliaryService } from './auxiliary.service';
import {
  RequireAction,
  RequireModule,
} from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { type Response } from 'express';

@Controller('auxiliary/records')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.AUXILIARY)
export class AuxiliaryController {
  constructor(private readonly auxiliaryService: AuxiliaryService) {}

  @Get() list() {
    return this.auxiliaryService.list();
  }

  @Post()
  @RequireAction('create')
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 3,
        fields: 1,
        fieldSize: 250000,
      },
    }),
  )
  create(
    @Body('payload') raw: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('userId') userId: string,
  ) {
    return this.auxiliaryService.save(raw, files || [], userId, false);
  }

  @Put(':id')
  @RequireAction('update')
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 3,
        fields: 1,
        fieldSize: 250000,
      },
    }),
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('payload') raw: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('userId') userId: string,
  ) {
    return this.auxiliaryService.save(raw, files || [], userId, true, id);
  }

  @Patch(':id') @RequireAction('delete') archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { revision: number; restore?: boolean },
    @CurrentUser('userId') userId: string,
  ) {
    return this.auxiliaryService.archive(
      id,
      body.revision,
      body.restore === true,
      userId,
    );
  }

  @Get(':id/pdf') async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const bytes = await this.auxiliaryService.pdf(id);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="avioa-${id}.pdf"`,
        'Cache-Control': 'private, no-store',
      })
      .send(Buffer.from(bytes));
  }

  @Get(':id/files/:fileId') async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
  ) {
    const data = await this.auxiliaryService.image(id, fileId);
    res
      .set({
        'Content-Type': data.asset.type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(data.bytes);
  }
}
