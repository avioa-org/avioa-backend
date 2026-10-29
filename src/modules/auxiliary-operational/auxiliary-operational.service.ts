import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import type { ICurrentUser } from 'src/common/decorator/current-user.decorator';
import { SqlDatabase } from './postgres.repository';
import { requestContext } from './runtime';
import { routes } from './routes';
import type { Request as ExpressRequest } from 'express';
import { envs } from '../../config/env.config';
import { Modules } from '../../common/enum/modules.enum';
import { Role } from 'generated/prisma/enums';

type RequestPayload = Record<string, unknown>;

function isRequestPayload(value: unknown): value is RequestPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class AuxiliaryOperationalService {
  constructor(
    private readonly database: SqlDatabase,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}
  async handle(
    req: ExpressRequest,
    files: Express.Multer.File[],
    path: string,
  ) {
    const user = (req as ExpressRequest & { user: ICurrentUser }).user;
    if (!user?.userId) throw new ForbiddenException();
    const permissions =
      user.modulePermissions ||
      (await this.prisma.modulePermission.findMany({
        where: {
          userId: user.userId,
          module: Modules.AUXILIARY,
          canAccess: true,
        },
      }));
    const active = permissions.filter(
      (p) => p.module === 'AUXILIARY' && p.canAccess !== false,
    );
    const allowed = (action: string) =>
      user.role === Role.ADMIN ||
      active.some((p) => !p.actions?.length || p.actions.includes(action));
    const canWrite = ['create', 'update', 'delete'].some(allowed);
    let payload: RequestPayload = isRequestPayload(req.body) ? req.body : {};
    if (typeof payload.payload === 'string') {
      try {
        const parsed: unknown = JSON.parse(payload.payload);
        payload = isRequestPayload(parsed) ? parsed : {};
      } catch {
        throw new BadRequestException('Datos inválidos.');
      }
    }
    const payloadAction =
      typeof payload.action === 'string' ? payload.action : undefined;
    const action =
      req.method === 'DELETE'
        ? 'delete'
        : /\/extract$/.test(path)
          ? 'create'
          : path.startsWith('documents/')
            ? 'update'
            : payloadAction === 'delete'
              ? 'delete'
              : [
                    'update',
                    'edit',
                    'updateTours',
                    'manual',
                    'confirm',
                    'send',
                    'voucher',
                  ].includes(payloadAction ?? '')
                ? 'update'
                : payload.id
                  ? 'update'
                  : 'create';
    // Reading an existing password intentionally requires the same read permission as the source module.
    if (!['GET', 'HEAD'].includes(req.method) && !allowed(action))
      throw new ForbiddenException('Acción no autorizada para Auxiliares.');
    const route = routes.find((route) => route.pattern.test(path));
    const handler = route?.handlers[req.method];
    if (!route || !handler)
      throw new NotFoundException('Ruta de Auxiliares no encontrada.');
    const id = route.pattern.exec(path)?.[1];
    const secret = envs.AUXILIARY_ENCRYPTION_KEY || envs.PASSWORD_MASTER_KEY;
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret))
      throw new ServiceUnavailableException(
        'Configura una clave de cifrado válida.',
      );
    const incomingHeaders = new Headers();
    let body: BodyInit | undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.is('multipart/form-data')) {
        const form = new FormData();
        for (const [key, value] of Object.entries(req.body || {})) {
          for (const v of Array.isArray(value) ? value : [value])
            form.append(key, String(v));
        }
        if (files.reduce((n, f) => n + f.size, 0) > 16 * 1024 * 1024)
          throw new BadRequestException('Máximo 16 MB de archivos por carga.');
        for (const file of files)
          form.append(
            file.fieldname,
            new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
            file.originalname,
          );
        body = form;
      } else {
        incomingHeaders.set('content-type', 'application/json');
        body = JSON.stringify(req.body || {});
      }
    }
    const query = req.originalUrl.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : '';
    const request = new Request(
      'http://auxiliary.internal/api/auxiliary/' + path + query,
      { method: req.method, headers: incomingHeaders, body },
    );
    return requestContext.run(
      {
        DB: this.database,
        BUCKET: {
          put: (key, bytes) =>
            this.storage.uploadFile(
              key,
              Buffer.from(bytes),
              'application/octet-stream',
            ),
          get: async (key) => {
            try {
              const data = await this.storage.downloadFile(key);
              return { arrayBuffer: async () => Uint8Array.from(data).buffer };
            } catch (error) {
              if ((error as { statusCode?: string })?.statusCode === '404')
                return null;
              throw error;
            }
          },
          delete: (key) => this.storage.deleteFile(key),
        },
        VAULT_ENCRYPTION_KEY: secret,
        TRANSFER_RESEND_API_KEY: envs.TRANSFER_RESEND_API_KEY,
        TRANSFER_EMAIL_ENABLED: envs.TRANSFER_EMAIL_ENABLED,
        actor: user.email,
        name: user.name,
        canWrite,
      },
      () => handler(request, { params: Promise.resolve({ id }) }),
    );
  }
}
