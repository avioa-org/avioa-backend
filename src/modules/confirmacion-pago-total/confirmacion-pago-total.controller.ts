import { Controller } from '@nestjs/common';
import { ConfirmacionPagoTotalService } from './confirmacion-pago-total.service';

@Controller('confirmacion-pago-total')
export class ConfirmacionPagoTotalController {
  constructor(
    private readonly confirmacionPagoTotalService: ConfirmacionPagoTotalService,
  ) {}
}
