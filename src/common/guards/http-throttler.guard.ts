import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  canActivate(context: ExecutionContext): Promise<boolean> {
    // Solo aplica throttling global a HTTP para evitar fricción en gateways WS.
    if (context.getType<'http' | 'ws' | 'rpc'>() !== 'http') {
      return Promise.resolve(true);
    }

    return super.canActivate(context);
  }
}
