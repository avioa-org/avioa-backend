import { Module } from "@nestjs/common";
import { PrismaModule } from "src/infrastructure/prisma/prisma.module";
import { FlightBlockingsController } from "./flight-blockings.controller";
import { FlightBlockingsService } from "./flight-blockings.service";
import { TravelCompositorClient } from "./travel-compositor.client";
import { GoogleSheetClient } from "./google-sheet.client";

@Module({
  imports: [PrismaModule],
  controllers: [FlightBlockingsController],
  providers: [
    FlightBlockingsService,
    TravelCompositorClient,
    GoogleSheetClient,
  ],
  exports: [FlightBlockingsService],
})
export class FlightBlockingsModule {}