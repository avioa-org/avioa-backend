import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
const { QueryError } = require('./engine.cjs');
@Catch()
export class OffersApiFilter implements ExceptionFilter {
  private readonly logger = new Logger('OffersApi');
  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = error instanceof QueryError ? error.status : error instanceof HttpException ? error.getStatus() : 500;
    // Never log query text, customer data, authorization headers or database payloads.
    if (status >= 500) this.logger.warn('Consulta de ofertas fallida: HTTP ' + status);
    response.status(status).setHeader('Cache-Control', 'no-store');
    if (status === 401) response.setHeader('WWW-Authenticate', 'Bearer realm="ofertas"');
    if (status === 429) response.setHeader('Retry-After', '60');
    response.json({ error: { code: error instanceof QueryError ? error.code : status >= 500 ? 'servicio_no_disponible' : 'solicitud_invalida', message: error instanceof QueryError ? error.message : status >= 500 ? 'No se pudo consultar el catálogo. Intenta de nuevo.' : 'Solicitud inválida.' } });
  }
}
