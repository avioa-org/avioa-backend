import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CommercialService } from "./commercial.service";
import {
  CreateCommercialResourceDto,
  UpdateCommercialResourceDto,
} from "./dto/resource.dto";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";
import { Modules } from "src/common/enum/modules.enum";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";

@Controller("commercial/resources")
@RequireModule(Modules.COMMERCIAL)
export class CommercialController {
  constructor(private readonly service: CommercialService) {}

  @Get()
  list(@Query("kind") kind?: string) {
    return this.service.list(kind as never);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequireModule(Modules.COMMERCIAL)
  create(@Body() dto: CreateCommercialResourceDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequireModule(Modules.COMMERCIAL)
  update(@Param("id") id: string, @Body() dto: UpdateCommercialResourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequireModule(Modules.COMMERCIAL)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}