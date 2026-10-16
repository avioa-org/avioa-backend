import { Module } from '@nestjs/common';
import { VuelosService } from './vuelos.service';
import { VuelosController } from './vuelos.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [VuelosController],
  providers: [VuelosService],
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
})
export class VuelosModule {}
