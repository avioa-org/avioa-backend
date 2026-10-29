import {
  All,
  Controller,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { AuxiliaryOperationalService } from './auxiliary-operational.service';
@Controller('auxiliary-operational')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.AUXILIARY)
export class AuxiliaryOperationalController {
  constructor(private readonly service: AuxiliaryOperationalService) {}
  @All(['', '*path'])
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        files: 10,
        fileSize: 8 * 1024 * 1024,
        fields: 5,
        fieldSize: 2000000,
      },
    }),
  )
  async dispatch(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parameter = req.params.path;
    const path = Array.isArray(parameter)
      ? parameter.join('/')
      : String(parameter || '');
    const result = await this.service.handle(req, files || [], path);
    res.status(result.status);
    result.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await result.arrayBuffer()));
  }
}
