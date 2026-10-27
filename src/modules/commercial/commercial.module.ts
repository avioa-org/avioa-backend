import { Module } from "@nestjs/common";
import { CommercialController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { AuthorizationModule } from "../../common/authorization/authorization.module";

@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [CommercialController],
  providers: [CommercialService],
  exports: [CommercialService],
})
export class CommercialModule {}