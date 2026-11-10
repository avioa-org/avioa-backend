import { Module } from "@nestjs/common";
import { PrismaModule } from "src/infrastructure/prisma/prisma.module";
import { CommercialController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";
import { CommercialNiltzeController } from "./commercial-niltze.controller";
import { CommercialAiController } from "./commercial-ai.controller";
import { CommercialNiltzeService } from "./commercial-niltze.service";
import { CommercialVideosController } from "./commercial-videos.controller";
import { CommercialVideosService } from "./commercial-videos.service";
import { CommercialProtocolController } from "./commercial-protocol.controller";
import { CommercialProtocolService } from "./commercial-protocol.service";
import { CommercialDriveTablesController } from "./commercial-drive-tables.controller";
import { CommercialDriveTablesService } from "./commercial-drive-tables.service";
import { CommercialQuickRepliesController } from "./commercial-quick-replies.controller";
import { CommercialQuickRepliesService } from "./commercial-quick-replies.service";
import { AiQuoteModule } from "./ai-quote/domain/ai-quote.module";

@Module({
  imports: [PrismaModule, AiQuoteModule],
  controllers: [
    CommercialController,
    CommercialNiltzeController,
    CommercialVideosController,
    CommercialAiController,
    CommercialProtocolController,
    CommercialDriveTablesController,
    CommercialQuickRepliesController,
  ],
  providers: [
    CommercialService,
    CommercialNiltzeService,
    CommercialVideosService,
    CommercialProtocolService,
    CommercialDriveTablesService,
    CommercialQuickRepliesService,
  ],
  exports: [CommercialService, CommercialVideosService],
})
export class CommercialModule {}