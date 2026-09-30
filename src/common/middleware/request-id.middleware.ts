import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from '../context/request-context.store';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incomingRequestId = req.header('x-request-id');
  const requestId = incomingRequestId?.trim() || randomUUID();

  req['requestId'] = requestId;
  res.setHeader('x-request-id', requestId);

  const contextStore = {
    requestId,
    ip: req.ip || req.socket?.remoteAddress,
    method: req.method,
    path: req.originalUrl || req.url,
  };

  requestContextStorage.run(contextStore, () => {
    next();
  });
}
