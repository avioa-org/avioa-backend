import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EquipmentLoansService } from './equipment-loans.service';
import { EquipmentLoansController } from './equipment-loans.controller';
import { EquipmentLoansGateway } from './equipment-loans.gateway';
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
  controllers: [EquipmentLoansController],
  providers: [
    EquipmentLoansService,
    EquipmentLoansGateway,
    EvolutionApiService,
  ],
})
export class EquipmentLoansModule {}