import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  HttpCode,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { FlightBlockingsService } from "./flight-blockings.service";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";

interface Upload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller("flight-blockings")
@UseGuards(JwtAuthGuard)
export class FlightBlockingsController {
  constructor(private readonly service: FlightBlockingsService) {}

  @Post('webhook-tc')
  @HttpCode(200)
  async handleTcWebhook(@Body() body: any) {
    // Como el JSON es un array, verificamos que venga así
    const trips = Array.isArray(body) ? body : [body];
    
    // Llamamos al servicio en "segundo plano" para responderle 200 OK a TC rápido
    this.service.syncFromWebhook(trips).catch(err => {
      console.error("Error procesando webhook de TC:", err);
    });

    return { ok: true, received: trips.length };
  }

  @Get()
  @Header("Cache-Control", "private, no-store")
  getBoard(@CurrentUser("userId") userId: string) {
    return this.service.getBoard({
      email: userId,
      permissions: ["flight-blockings:read", "flight-blockings:admin"],
    });
  }

  @Post()
  @Header("Cache-Control", "private, no-store")
  handleAction(@Body() body: unknown, @CurrentUser("userId") userId: string) {
    return this.service.handleAction(body, {
      email: userId,
      permissions: ["flight-blockings:admin"],
    });
  }

  @Post("files")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 2,
        fieldSize: 1024,
      },
    }),
  )
  upload(
    @UploadedFile() file: Upload | undefined,
    @Body("blockId") blockId: string,
    @Body("kind") kind: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.service.uploadFile(file, blockId, kind, {
      email: userId,
      permissions: ["flight-blockings:admin"],
    });
  }

  @Get("files/:id")
  async download(@Param("id") id: string, @Res() response: Response) {
    const file = await this.service.downloadFile(id);
    response.set({
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.send(Buffer.from(file.bytes));
  }

  @Get("files")
  downloadLegacy(@Query("id") id: string, @Res() response: Response) {
    return this.download(id, response);
  }
}