import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { CommercialEmailService } from './commercial-email.service';

@Module({
  imports: [PrismaModule],
  providers: [CommercialEmailService],
  exports: [CommercialEmailService],
})
export class CommercialEmailModule {}