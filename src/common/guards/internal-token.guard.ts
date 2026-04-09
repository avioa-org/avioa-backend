import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { envs } from 'src/config/env.config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const internalToken = request.headers['x-internal-token'] as string;
    return internalToken === envs.INTERNAL_TOKEN;
  }
}
