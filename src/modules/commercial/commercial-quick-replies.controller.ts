import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { CommercialQuickRepliesService } from "./commercial-quick-replies.service";

@Controller("commercial/quick-replies")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
export class CommercialQuickRepliesController {
  constructor(private readonly service: CommercialQuickRepliesService) {}

  @Get()
  get(@Query("refresh") refresh?: string) {
    return this.service.getReplies(
      refresh === "1" || refresh === "true",
    );
  }
}