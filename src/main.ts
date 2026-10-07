import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { envs } from './config/env.config';
import { loggerConfig } from './config/logger.config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception-filter.filter';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig,
    bufferLogs: true,
  });

  app.useLogger(loggerConfig);
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: [
      'http://localhost:3000', // Frontend local
      'http://localhost:3001', // Backend local
      'https://avioa-frontend.vercel.app', // Producción
      'http://127.0.0.1:3000',
    ],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

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
      new BullMQAdapter(
        new Queue('cotizador', {
          connection: {
            url: envs.REDIS_URL,
          },
        }),
      ),
    ],
    serverAdapter,
  });

  app.use('/queues', (req, res, next) => {
    const auth: string = req.headers.authorization;

    if (!auth?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Queues"');
      return res.status(401).send('Authentication required');
    }

    const encoded = auth.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');

    const [username, password] = decoded.split(':');

    if (username !== envs.QUEUES_USER || password !== envs.QUEUES_PASSWORD) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Queues"');
      return res.status(401).send('Invalid credentials');
    }

    next();
  });
  app.use('/queues', serverAdapter.getRouter());

  console.log('Before listen...');

  await app.listen(process.env.PORT ?? 3001);

  console.log('Listeeennnn');
}
bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
