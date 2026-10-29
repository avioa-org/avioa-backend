import {
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AuxiliaryDocumentAiService } from './auxiliary-document-ai.service';
import { ExtractAuxiliaryDocumentDto } from './dto/extract-auxiliary-document.dto';
import { Body } from '@nestjs/common';

@Controller('auxiliary-operational/documents')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.AUXILIARY)
export class AuxiliaryDocumentAiController {
  constructor(private readonly service: AuxiliaryDocumentAiService) {}

  @Post(':id/extract')
  @Header('Cache-Control', 'private, no-store')
  extract(
    @CurrentUser() user: ICurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExtractAuxiliaryDocumentDto,
  ) {
    return this.service.extract(user, id, dto);
  }
}
