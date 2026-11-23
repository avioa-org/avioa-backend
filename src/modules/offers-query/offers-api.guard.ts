import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
const core = require('./engine.cjs');

@Injectable()
export class OffersApiGuard implements CanActivate {
  private bucket = { minute: 0, count: 0 };
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (process.env.OFFERS_BOT_API_ENABLED !== 'true') throw new core.QueryError(503, 'api_desactivada', 'La API comercial está deshabilitada.');
    core.authenticate(req.headers.authorization, process.env.OFFERS_BOT_TOKEN_SHA256);
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.bucket.minute) this.bucket = { minute, count: 0 };
    if (++this.bucket.count > 120) throw new core.QueryError(429, 'limite_consultas', 'Espera un minuto antes de repetir la consulta.');
    return true;
  }
}
