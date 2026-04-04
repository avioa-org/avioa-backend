import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PagoTotalService } from './pago-total.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PagoTotalEventosDto } from './dto/pago-total.dto';
import { envs } from 'src/config/env.config';

@Controller('pago-total')
export class PagoTotalController {
  constructor(
    private readonly pagoTotalService: PagoTotalService,
    @InjectQueue('pago-total') private readonly queue: Queue,
  ) {}

  @Get('sheet')
  async obtenerParaSheet(@Headers('x-internal-token') token: string) {
    if (token !== envs.internalToken) {
      throw new UnauthorizedException();
    }

    return await this.pagoTotalService.obtenerParaSheet();
  }

  @Post()
  async recibirEventos(
    @Headers('x-internal-token') token: string,
    @Body() body: PagoTotalEventosDto,
  ) {
    if (token !== envs.internalToken) {
      throw new UnauthorizedException();
    }

    // Se procesa un job por hilo asi se procesan en paralelo
    // y si uno fall no bloquea los demas
    await Promise.all(
      body.eventos.map((evento) =>
        this.queue.add('procesar-hilo', evento, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100, // Se guarda los ultimos 100 completados
          removeOnFail: 50,
        }),
      ),
    );

    return { ok: true, encolados: body.eventos.length };
  }
}
