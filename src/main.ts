import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { envs, isProd } from './config/env.config';
import { loggerConfig } from './config/logger.config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bufferLogs: true,
  });

  const logger = isProd ? loggerConfig : new Logger();

  app.useLogger(logger);

  app.setGlobalPrefix('/api/v1/');

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(
        new Queue('pago-total', {
          connection: {
            host: envs.REDIS_HOST || 'localhost',
            port: Number(envs.REDIS_PORT) || 6379,
          },
        }),
      ),
    ],
    serverAdapter,
  });

  app.use('/queues', serverAdapter.getRouter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
