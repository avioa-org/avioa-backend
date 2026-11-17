import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { CommercialRatesController } from './commercial-rates.controller';
import { CommercialRatesService } from './commercial-rates.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommercialRatesController],
  providers: [CommercialRatesService],
  exports: [CommercialRatesService],
})
export class CommercialRatesModule {}