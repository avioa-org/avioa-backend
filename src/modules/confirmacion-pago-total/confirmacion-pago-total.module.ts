import { Module } from '@nestjs/common';
import { ConfirmacionPagoTotalService } from './confirmacion-pago-total.service';
import { ConfirmacionPagoTotalController } from './confirmacion-pago-total.controller';

@Module({
  controllers: [ConfirmacionPagoTotalController],
  providers: [ConfirmacionPagoTotalService],
})
export class ConfirmacionPagoTotalModule {}
