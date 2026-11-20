import { Module } from '@nestjs/common';
import { OffersManagerService } from './offers-manager.service';
import { OffersManagerController } from './offers-manager.controller';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { OffersRuntimeModule } from 'src/infrastructure/offers-runtime/offers-runtime.module';

@Module({
  controllers: [OffersManagerController],
  providers: [OffersManagerService],
  imports: [PrismaModule, OffersRuntimeModule],
})
export class OffersManagerModule {}
