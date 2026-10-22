import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { TransfersMessagingService } from './transfers-messaging.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [PrismaModule, GoogleModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersMessagingService],
})
export class TransfersModule {}
