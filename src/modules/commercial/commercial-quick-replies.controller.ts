import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
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
  get() {
    return this.service.getReplies();
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No se envió archivo.");
    return this.service.importFromExcel(file.buffer);
  }

  @Post()
  create(@Body("title") title: string, @Body("text") text: string) {
    return this.service.createReply(title, text);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body("title") title: string, @Body("text") text: string) {
    return this.service.updateReply(id, title, text);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.service.deleteReply(id);
  }
}