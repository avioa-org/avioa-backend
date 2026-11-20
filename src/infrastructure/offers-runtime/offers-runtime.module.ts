import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { OffersRuntimeService } from './offers-runtime.service';

@Module({
  imports: [PrismaModule],
  providers: [OffersRuntimeService],
  exports: [OffersRuntimeService],
})
export class OffersRuntimeModule {}
