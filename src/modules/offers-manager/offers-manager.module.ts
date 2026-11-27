import { OffersQueryModule } from '../offers-query/offers-query.module';
import { Module } from '@nestjs/common';
import { OffersManagerService } from './offers-manager.service';
import { OffersManagerController } from './offers-manager.controller';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { OffersRuntimeModule } from 'src/infrastructure/offers-runtime/offers-runtime.module';
import { OffersManagerNativeController } from './offers-manager.native.controller';
import { OffersManagerNativeService } from './offers-manager.native.service';

@Module({
  controllers: [OffersManagerController, OffersManagerNativeController],
  providers: [OffersManagerService, OffersManagerNativeService],
  imports: [PrismaModule, OffersRuntimeModule, OffersQueryModule],
})
export class OffersManagerModule {}
