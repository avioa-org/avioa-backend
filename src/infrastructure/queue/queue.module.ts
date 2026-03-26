import { Global, Module } from '@nestjs/common';
import { RedisConnection } from './redis.connection';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisConnection],
  exports: [RedisConnection],
})
export class QueueModule {}
