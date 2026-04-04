import { Module } from '@nestjs/common';
import { PagoTotalService } from './pago-total.service';
import { PagoTotalController } from './pago-total.controller';
import { BullModule } from '@nestjs/bullmq';
import { PagoTotalProcessor } from './pago-total.processor';
import { PagoTotalClasificadorService } from './pago-total-clasificador.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [PagoTotalController],
  providers: [
    PagoTotalService,
    PagoTotalProcessor,
    PagoTotalClasificadorService,
    PrismaService,
  ],
  imports: [BullModule.registerQueue({ name: 'pago-total' })],
})
export class PagoTotalModule {}
