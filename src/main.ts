import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { envs, isProd } from './config/env.config';
import { loggerConfig } from './config/logger.config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception-filter.filter';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bufferLogs: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(requestIdMiddleware);

  const corsOrigins = envs.FRONTEND_URL.split(',').map((origin) =>
    origin.trim(),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const logger = isProd ? loggerConfig : new Logger();

  app.useLogger(logger);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

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
            url: envs.REDIS_URL,
          },
        }),
      ),
    ],
    serverAdapter,
  });

  app.use('/queues', (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7).trim()
      : header?.trim();

    if (!token || token !== envs.INTERNAL_TOKEN) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Unauthorized',
        error: 'INVALID_INTERNAL_TOKEN',
      });
    }

    next();
  });
  app.use('/queues', serverAdapter.getRouter());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
