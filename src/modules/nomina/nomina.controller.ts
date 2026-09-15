import { Controller } from '@nestjs/common';
import { NominaService } from './nomina.service';

@Controller('nomina')
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}
}
