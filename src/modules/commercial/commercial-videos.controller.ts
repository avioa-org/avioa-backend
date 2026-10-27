import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  RequireAction,
  RequireModule,
} from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { CommercialVideosService } from "./commercial-videos.service";
import { VideoActionDto } from "./dto/video.dto";

@Controller("commercial/videos")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class CommercialVideosController {
  constructor(private readonly service: CommercialVideosService) {}

  @Get()
  list(@Query("refresh") refresh?: string) {
    return this.service.list(refresh === "1" || refresh === "true");
  }

  @Post()
  @RequireAction("create")
  action(
    @Body() dto: VideoActionDto,
    @CurrentUser("userId") userId: string,
  ) {
    // "delete" no requiere create, pero el guard es por controller.
    // Si necesitas permisos finos por action, se puede dividir en sub-rutas.
    return this.service.handleAction(dto, userId);
  }
}