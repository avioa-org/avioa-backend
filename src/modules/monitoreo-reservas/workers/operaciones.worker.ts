import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { RedisConnection } from 'src/infrastructure/queue/redis.connection';
import { MonitoreoReservasService } from '../monitoreo-reservas.service';

@Injectable()
export class OperacionesWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(OperacionesWorker.name);

  constructor(
    private redis: RedisConnection,
    private monitoreoReservasService: MonitoreoReservasService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Iniciando OperacionesWorker...');

    this.worker = new Worker(
      'operaciones',
      async (job: Job) => {
        this.logger.log(`🔥 Recibido job: ${job.name} (id: ${job.id})`);

        try {
          if (job.name === 'procesar-operaciones') {
            console.log('🔥 Procesando operaciones...');
            await this.monitoreoReservasService.procesarAlertas();
            this.logger.log(`✅ Job ${job.id} completado correctamente`);
          } else {
            this.logger.warn(`Nombre de job desconocido: ${job.name}`);
          }
        } catch (error) {
          this.logger.error(`❌ Error en job ${job.id}:`, error);
          throw error;
        }
      },
      {
        connection: this.redis.getClient(),
        concurrency: 1,
        maxStalledCount: 2,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`✅ Job completado: ${job.name} (${job.id})`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`❌ Job ${job?.id} falló: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`Error general en Worker: ${err.message}`);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`⚠️ Job stalled: ${jobId}`);
    });

    this.logger.log(
      '✅ OperacionesWorker listo y escuchando la cola "operaciones"',
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      this.logger.log('Cerrando Worker...');
      await this.worker.close();
    }
  }
}
