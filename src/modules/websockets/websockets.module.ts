import { Global, Module } from '@nestjs/common';
import { SocketGateway } from '../points/gateway/points.gateway';

@Global()
@Module({
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class WebsocketsModule {}
