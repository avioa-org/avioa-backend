import { Module } from '@nestjs/common';
import { CotizadorService } from './cotizador.service';
import { CotizadorController } from './cotizador.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { CotizadorProcessor } from './cotizador.processor';

@Module({
  controllers: [CotizadorController],
  providers: [CotizadorService, PrismaService, CotizadorProcessor],
  imports: [
    BullModule.registerQueue({
      name: 'cotizador',
    }),

    HttpModule.register({
      timeout: 300000,
      maxRedirects: 5,
    }),
  ],
})
export class CotizadorModule {}
