import { Controller } from '@nestjs/common';
import { CesantiasService } from './cesantias.service';

@Controller('cesantias')
export class CesantiasController {
  constructor(private readonly cesantiasService: CesantiasService) {}
}
