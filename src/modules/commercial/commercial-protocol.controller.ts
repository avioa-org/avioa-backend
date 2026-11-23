import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
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

  // 1. Obtener todo el protocolo (GET)
  @Get()
  get(@Query("refresh") refresh?: string) {
    return this.service.getProtocol(refresh === "1" || refresh === "true");
  }

  // 2. Importar desde Excel (POST)
  @Post("import")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No se envió archivo.");
    return this.service.importFromExcel(file.buffer);
  }

  // 3. Crear una nueva Sección (POST)
  @Post("sections")
  createSection(@Body("title") title: string) {
    if (!title) throw new BadRequestException("El título es obligatorio.");
    return this.service.createSection(title);
  }

  // 4. Actualizar el título de una Sección (PATCH)
  @Patch("sections/:id")
  updateSection(@Param("id") id: string, @Body("title") title: string) {
    if (!title) throw new BadRequestException("El título es obligatorio.");
    return this.service.updateSection(id, title);
  }

  // 5. Eliminar una Sección (DELETE)
  @Delete("sections/:id")
  deleteSection(@Param("id") id: string) {
    return this.service.deleteSection(id);
  }

  // 6. Crear un Paso dentro de una Sección (POST)
  @Post("sections/:id/steps")
  createStep(
    @Param("id") sectionId: string,
    @Body("label") label: string,
    @Body("text") text: string,
  ) {
    if (!label || !text) {
      throw new BadRequestException("La etiqueta y el texto son obligatorios.");
    }
    return this.service.createStep(sectionId, label, text);
  }

  // 7. Eliminar un Paso (DELETE)
  @Delete("steps/:id")
  deleteStep(@Param("id") id: string) {
    return this.service.deleteStep(id);
  }
}