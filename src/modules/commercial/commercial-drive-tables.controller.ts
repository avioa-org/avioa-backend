import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { CommercialDriveTablesService } from "./commercial-drive-tables.service";

@Controller("commercial/drive-tables")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
export class CommercialDriveTablesController {
  constructor(private readonly service: CommercialDriveTablesService) {}

  @Get()
  get(
    @Query("source") source: string,
    @Query("refresh") refresh?: string,
  ) {
    return this.service.getTable(
      source,
      refresh === "1" || refresh === "true",
    );
  }
}