import {
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { RequireModule } from "src/common/decorator/modules-permission.decorator";
import { Modules } from "src/common/enum/modules.enum";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { ModulePermissionGuard } from "src/common/guards/module-permission.guard";

interface AiRequestDto {
  requestId?: string;
  message?: string;
  history?: Array<{ question: string; answer: string }>;
}

@Controller("commercial")
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.COMMERCIAL)
export class CommercialAiController {
  @Post("quotes")
  quotes(
    @Body() _body: AiRequestDto,
    @CurrentUser("userId") _userId: string,
  ) {
    throw new ServiceUnavailableException(
      "El consultor de tarifario con IA aún no está configurado. Contacta al administrador.",
    );
  }

  @Post("email")
  email(
    @Body() _body: AiRequestDto,
    @CurrentUser("userId") _userId: string,
  ) {
    throw new ServiceUnavailableException(
      "El asistente de correos con IA aún no está configurado. Contacta al administrador.",
    );
  }
}