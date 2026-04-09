import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PagoTotalService } from './pago-total.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PagoTotalEventosDto } from './dto/pago-total.dto';
import { InternalTokenGuard } from 'src/common/guards/internal-token.guard';

@Controller('pago-total')
export class PagoTotalController {
  constructor(
    private readonly pagoTotalService: PagoTotalService,
    @InjectQueue('pago-total') private readonly queue: Queue,
  ) {}

  @UseGuards(InternalTokenGuard)
  @Get('sheet')
  async obtenerParaSheet() {
    return await this.pagoTotalService.obtenerParaSheet();
  }

  @UseGuards(InternalTokenGuard)
  @Post()
  async recibirEventos(@Body() body: PagoTotalEventosDto) {
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
