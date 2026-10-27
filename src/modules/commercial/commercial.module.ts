import { Module } from "@nestjs/common";
import { PrismaModule } from "src/infrastructure/prisma/prisma.module";
import { CommercialController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";
// import { CommercialFlightsController } from "./commercial-flights.controller";
// import { CommercialFlightsService } from "./commercial-flights.service";
// import { CommercialFeaturesController } from "./commercial-features.controller";
// import { CommercialFeaturesService } from "./commercial-features.service";
import { CommercialNiltzeController } from "./commercial-niltze.controller";
import { CommercialNiltzeService } from "./commercial-niltze.service";
import { CommercialVideosController } from "./commercial-videos.controller";
import { CommercialVideosService } from "./commercial-videos.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    CommercialController,
    // CommercialFlightsController,
    // CommercialFeaturesController,
    CommercialNiltzeController,
    CommercialVideosController,   
  ],
  providers: [
    CommercialService,
    // CommercialFlightsService,
    // CommercialFeaturesService,
    CommercialNiltzeService, 
    CommercialVideosService,      
  ],
  exports: [CommercialService, CommercialVideosService],
})
export class CommercialModule {}