import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { CommercialNiltzeService } from "./commercial-niltze.service";

@Controller("commercial/niltze")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
export class CommercialNiltzeController {
  constructor(private readonly service: CommercialNiltzeService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.getById(id);
  }
}