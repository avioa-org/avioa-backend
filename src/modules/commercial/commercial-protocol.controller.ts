import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { CommercialProtocolService } from "./commercial-protocol.service";

@Controller("commercial/protocol")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
export class CommercialProtocolController {
  constructor(private readonly service: CommercialProtocolService) {}

  @Get()
  get(@Query("refresh") refresh?: string) {
    return this.service.getProtocol(refresh === "1" || refresh === "true");
  }
}