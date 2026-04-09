import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AlertaReservasService } from './alerta-reservas.service';
import { AlertaReservasDto } from './dto/alerta-reservas.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InternalTokenGuard } from 'src/common/guards/internal-token.guard';

@Controller('alerta-reservas')
export class AlertaReservasController {
  constructor(
    private readonly alertaReservasService: AlertaReservasService,
    @InjectQueue('alerta-reservas') private readonly queue: Queue,
  ) {}

  @UseGuards(InternalTokenGuard)
  @Post()
  async procesarReservas(@Body() body: AlertaReservasDto) {
    await Promise.all(
      body.eventos.map((evento) =>
        this.queue.add('procesar-reserva', evento, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }),
      ),
    );

    return { ok: true, encolados: body.eventos.length };
  }
}
