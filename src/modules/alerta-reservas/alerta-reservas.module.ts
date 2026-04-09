import { Module } from '@nestjs/common';
import { AlertaReservasService } from './alerta-reservas.service';
import { AlertaReservasController } from './alerta-reservas.controller';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { AlertaReservasProcessor } from './alerta-reservas.processor';

@Module({
  controllers: [AlertaReservasController],
  providers: [AlertaReservasService, AlertaReservasProcessor],
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'alerta-reservas' }),
  ],
})
export class AlertaReservasModule {}
