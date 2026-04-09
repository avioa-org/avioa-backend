import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { envs } from 'src/config/env.config';

@Injectable()
export class RedisConnection {
  private queueClient: Redis;
  private workerClient: Redis;

  constructor(private configService: ConfigService) {
    // Cliente para queues
    this.queueClient = new Redis(envs.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    // Cliente para workers
    this.workerClient = new Redis(envs.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  getClient(): Redis {
    return this.queueClient;
  }

  getWorkerClient(): Redis {
    return this.workerClient;
  }
}
