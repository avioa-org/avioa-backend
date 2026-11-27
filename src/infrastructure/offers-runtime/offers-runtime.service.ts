import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { HunterSyncService } from '../hunter-sync/hunter-sync.service';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

const loadCjs = (modulePath: string) => {
  if (typeof require !== 'undefined') {
    return require(modulePath);
  }
  const req = createRequire(modulePath);
  return req(modulePath);
};

type RuntimeHandle = {
  HTML: string;
  prepareProductImport: (input: any, current: any) => any[];
  mergeNamed: (payload: any, current: any) => any;
  available: (offer: any) => any;
  worker: { fetch: (req: Request, env: { DB: unknown }) => Promise<Response> };
};

type PostgresAdapterCtor = new (
  client: PrismaService,
  role: 'approver' | 'editor',
) => unknown;

export type OffersRuntimeResponse = {
  status: number;
  contentType: string;
  body: string;
};

@Injectable()
export class OffersRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(OffersRuntimeService.name);
  private runtime!: RuntimeHandle;
  private PostgresAdapter!: PostgresAdapterCtor;

  constructor(private readonly prisma: PrismaService, private readonly hunterSync: HunterSyncService) {}

  private resolveAsset(filename: string): string {
    const candidates = [
      join(__dirname, filename),
      join(process.cwd(), 'src', 'infrastructure', 'offers-runtime', filename),
      join(
        process.cwd(),
        'dist',
        'src',
        'infrastructure',
        'offers-runtime',
        filename,
      ),
      join(process.cwd(), 'dist', 'infrastructure', 'offers-runtime', filename),
      join(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'infrastructure',
        'offers-runtime',
        filename,
      ),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `No se encontró '${filename}'. Rutas comprobadas:\n` +
        candidates.map((c) => `  - ${c}`).join('\n'),
    );
  }

  onModuleInit() {
    try {
      const runtimePath = this.resolveAsset('runtime.cjs');
      const adapterPath = this.resolveAsset('postgres-adapter.cjs');

      this.logger.log(`Cargando Offers runtime desde: ${runtimePath}`);
      this.runtime = loadCjs(runtimePath) as RuntimeHandle;

      this.logger.log(`Cargando PostgresAdapter desde: ${adapterPath}`);
      const adapterModule = loadCjs(adapterPath) as {
        PostgresAdapter: PostgresAdapterCtor;
      };
      this.PostgresAdapter = adapterModule.PostgresAdapter;

      this.logger.log('Offers runtime cargado exitosamente');
    } catch (err: any) {
      this.logger.error(
        `Error al cargar el runtime de Ofertas: ${err?.message || err}`,
        err?.stack,
      );
      throw new InternalServerErrorException(
        `Offers runtime no disponible: ${err?.message || err}`,
      );
    }
  }

  normalizePayload(payload: any): any {
    const result = structuredClone(payload);
    result.offers.forEach(this.runtime.available);
    return result;
  }

  plannedState(payload: any, current: any): any {
    return this.runtime.mergeNamed(this.normalizePayload(payload), this.normalizePayload(current));
  }

  prepareImport(input: any, current: any): any[] {
    return this.runtime.prepareProductImport(input, current);
  }

  async getHtml(): Promise<string> {
    return this.hunterSync.html(this.runtime.HTML);
  }
  hunterStatus() { return this.hunterSync.status(); }
  hunterStart(full = false) { return this.hunterSync.trigger(full); }

  async dispatch(opts: {
    user: { userId: string; email: string };
    role: 'approver' | 'editor';
    path: string;
    method: string;
    query: string;
    body: unknown;
  }): Promise<OffersRuntimeResponse> {
    const db = new this.PostgresAdapter(this.prisma, opts.role);
    const origin = 'https://offers.internal';
    const request = new Request(`${origin}/api/${opts.path}${opts.query}`, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'oai-authenticated-user-id': opts.user.userId,
        'oai-authenticated-user-email': opts.user.email,
      },
      ...(['POST', 'PUT', 'PATCH'].includes(opts.method)
        ? { body: JSON.stringify(opts.body ?? {}) }
        : {}),
    });
    const response = await this.runtime.worker.fetch(request, { DB: db });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/json',
      body: await response.text(),
    };
  }
}
