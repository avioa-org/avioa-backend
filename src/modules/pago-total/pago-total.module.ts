import { Module } from '@nestjs/common';
import { PagoTotalService } from './pago-total.service';
import { PagoTotalController } from './pago-total.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  controllers: [PagoTotalController],
  providers: [PagoTotalService],
  imports: [BullModule.registerQueue({ name: 'pago-total' })],
})
export class PagoTotalModule {}
