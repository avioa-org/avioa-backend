import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisConnection } from 'src/infrastructure/queue/redis.connection';

@Injectable()
export class OperacionesQueue {
  private queue: Queue;

  constructor(private redis: RedisConnection) {
    this.queue = new Queue('operaciones', {
      connection: this.redis.getClient(),
    });
  }

  async addProcessarOperacionesJob() {
    console.log('entro al metodo');
    await this.queue.add(
      'procesar-operaciones',
      {},
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 segundos
        },
      },
    );
  }
}
