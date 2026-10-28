import { Module } from "@nestjs/common";
import { PrismaModule } from "src/infrastructure/prisma/prisma.module";
import { CommercialController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";
// import { CommercialFlightsController } from "./commercial-flights.controller";
// import { CommercialFlightsService } from "./commercial-flights.service";
// import { CommercialFeaturesController } from "./commercial-features.controller";
// import { CommercialFeaturesService } from "./commercial-features.service";
import { CommercialNiltzeController } from "./commercial-niltze.controller";
import { CommercialAiController } from "./commercial-ai.controller";
import { CommercialNiltzeService } from "./commercial-niltze.service";
import { CommercialVideosController } from "./commercial-videos.controller";
import { CommercialVideosService } from "./commercial-videos.service";
import { CommercialProtocolController } from "./commercial-protocol.controller";
import { CommercialProtocolService } from "./commercial-protocol.service";
import { CommercialDriveTablesController } from "./commercial-drive-tables.controller";
import { CommercialDriveTablesService } from "./commercial-drive-tables.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    CommercialController,
    // CommercialFlightsController,
    // CommercialFeaturesController,
    CommercialNiltzeController,
    CommercialVideosController,
    CommercialAiController,
    CommercialProtocolController,
    CommercialDriveTablesController,
  ],
  providers: [
    CommercialService,
    // CommercialFlightsService,
    // CommercialFeaturesService,
    CommercialNiltzeService, 
    CommercialVideosService,
    CommercialProtocolService,
    CommercialDriveTablesService     
  ],
  exports: [CommercialService, CommercialVideosService],
})
export class CommercialModule {}