import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { sanitizeMetadata } from '../../config/logger.config';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const { method, originalUrl, ip, body, query } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    const sanitizedBody = sanitizeMetadata(body);
    const sanitizedQuery = sanitizeMetadata(query);

    this.logger.debug(
      `--> ${method} ${originalUrl}`,
      JSON.stringify({
        query: sanitizedQuery,
        body: sanitizedBody,
        ip,
        userAgent,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          const logMessage = `<-- ${method} ${originalUrl} ${statusCode} +${duration}ms`;

          if (duration > 1000) {
            this.logger.warn(`[SLOW REQUEST] ${logMessage}`);
          } else {
            this.logger.log(logMessage);
          }
        },
        error: (error: any) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;
          this.logger.error(
            `<-- ${method} ${originalUrl} ${statusCode} +${duration}ms - Error: ${error.message}`,
          );
        },
      }),
    );
  }
}
