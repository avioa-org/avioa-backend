import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceGateway } from './maintenance.gateway';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { WebsocketsModule } from '../websockets/websockets.module';
import { EvolutionApiService } from '../../infrastructure/evolution-api/evolution-api.service';

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    WebsocketsModule,
    HttpModule,
  ],
  controllers: [MaintenanceController],
  providers: [
    MaintenanceService,
    MaintenanceGateway,
    EvolutionApiService,
  ],
})
export class MaintenanceModule {}