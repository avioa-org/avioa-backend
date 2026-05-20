import { Global, Module } from '@nestjs/common';
import { PointsGateway } from '../points/gateway/points.gateway';

@Global()
@Module({
  providers: [PointsGateway],
  exports: [PointsGateway],
})
export class WebsocketsModule {}
