import { Module } from '@nestjs/common';
import { EquipmentLoansService } from './equipment-loans.service';
import { EquipmentLoansController } from './equipment-loans.controller';
import { EquipmentLoansGateway } from './equipment-loans.gateway';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [PrismaModule, AuthorizationModule, WebsocketsModule],
  controllers: [EquipmentLoansController],
  providers: [EquipmentLoansService, EquipmentLoansGateway],
})
export class EquipmentLoansModule {}
