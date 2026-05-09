import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RedisConnection } from 'src/infrastructure/queue/redis.connection';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisConnection,
    @InjectQueue('pago-total') private readonly pagoTotalQueue: Queue,
  ) {
    super();
  }

  async isDatabaseHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { message: error?.message }),
      );
    }
  }

  async isRedisHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.getClient().ping();
      return this.getStatus(key, pong === 'PONG');
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: error?.message }),
      );
    }
  }

  async isQueueHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.pagoTotalQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
      );
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Queue check failed',
        this.getStatus(key, false, { message: error?.message }),
      );
    }
  }
}
