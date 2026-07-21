import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface IRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export const RequestContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IRequestContext => {
    const request = ctx.switchToHttp().getRequest();
    const forwarded = request.headers['x-forwarded-for'] as string | undefined;
    const ipAddress =
      (forwarded ? forwarded.split(',')[0].trim() : undefined) ??
      request.ip ??
      request.socket?.remoteAddress;

    const userAgent = request.headers['user-agent'] as string | undefined;

    return { ipAddress, userAgent };
  },
);
