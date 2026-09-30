import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContext } from '../context/request-context.store';
import { sanitizeMetadata } from '../../config/logger.config';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let error = 'Internal Server Error';
    let stack: string | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        message = (res as any).message || message;
        error = (res as any).error || error;
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      const errName = exception.constructor.name;
      stack = exception.stack;

      // Handle Prisma errors gracefully if matching Prisma signature
      if (errName.startsWith('PrismaClient')) {
        const prismaErr = exception as any;
        if (prismaErr.code === 'P2002') {
          status = HttpStatus.CONFLICT;
          error = 'Database Constraint Conflict';
          message = `Un recurso con esos datos ya existe (${prismaErr.meta?.target || 'campo duplicado'})`;
        } else if (prismaErr.code === 'P2025') {
          status = HttpStatus.NOT_FOUND;
          error = 'Resource Not Found';
          message = 'El registro solicitado no existe en la base de datos';
        } else {
          status = HttpStatus.BAD_REQUEST;
          error = 'Database Operation Error';
          message = 'Error al ejecutar la operación en la base de datos';
        }
      } else {
        message = exception.message || 'Error interno inesperado';
      }
    }

    const requestId = request.requestId || RequestContext.requestId || 'N/A';
    const userId = RequestContext.userId;

    const logDetails = {
      requestId,
      userId,
      path: request.url,
      method: request.method,
      statusCode: status,
      error,
      message,
      query: sanitizeMetadata(request.query),
      body: sanitizeMetadata(request.body),
    };

    if (status >= 500) {
      this.logger.error(
        `[5xx Error] ${request.method} ${request.url} - ${typeof message === 'object' ? JSON.stringify(message) : message}`,
        stack || JSON.stringify(logDetails),
      );
    } else {
      this.logger.warn(
        `[4xx Client Exception] ${request.method} ${request.url} [Status ${status}] - ${typeof message === 'object' ? JSON.stringify(message) : message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
