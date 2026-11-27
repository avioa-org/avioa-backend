import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { join } from 'node:path';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
const core = require(join(__dirname, 'hunter-sync.cjs'));
const runtime = require(join(__dirname, '..', 'offers-runtime', 'runtime.cjs'));
@Injectable()
export class HunterSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HunterSyncService.name);
  private running = false;
  private config: any;
  private configurationError: string | null = null;
  constructor(private readonly prisma: PrismaService) {
    try {
      this.config = core.parseConfig(process.env);
    } catch {
      this.config = { enabled: false };
      this.configurationError =
        'Configuración del conector incompleta o inválida.';
    }
  }
  onApplicationBootstrap() {
    if (this.config.enabled) this.trigger(true);
  }
  @Interval(15 * 60 * 1000)
  scheduledSync() {
    if (this.config.enabled) this.trigger(false);
  }
  trigger(full = false) {
    if (!this.config.enabled)
      return {
        accepted: false,
        disabled: true,
        error: this.configurationError,
      };
    if (this.running) return { accepted: false, running: true };
    this.running = true;
    void core
      .synchronize({
        prisma: this.prisma,
        config: this.config,
        seed: runtime.getHunterSeed(),
        ids: runtime.hunterHotelIds,
        full,
      })
      .then((result: any) => {
        if (!result.busy)
          this.logger.log(
            'Sincronización del cazador completada: ' +
              result.totalRates +
              ' tarifas conservadas.',
          );
      })
      .catch(() =>
        this.logger.warn(
          'No se completó la sincronización del cazador; se conservó el catálogo anterior.',
        ),
      )
      .finally(() => {
        this.running = false;
      });
    return { accepted: true, running: true };
  }
  async status(
    client?: Pick<
      PrismaService,
      'offersHunterSyncState' | 'offersHunterCapture'
    >,
  ): Promise<any> {
    if (!client)
      return this.prisma.$transaction((tx) => this.status(tx), {
        isolationLevel: 'RepeatableRead',
        timeout: 30000,
      });
    const state = await client.offersHunterSyncState.findUnique({
      where: { id: 1 },
    });
    const captures = await client.offersHunterCapture.findMany({
      select: { captureDate: true, rates: true, updatedAt: true },
      orderBy: { captureDate: 'desc' },
    });
    return {
      enabled: !!this.config.enabled,
      running: this.running,
      configurationError: this.configurationError,
      lastSuccessAt: state?.lastSuccessAt || null,
      lastError: state?.lastError || null,
      totalRates: state?.totalRates || 0,
      captures: captures.map((c) => ({
        date: c.captureDate,
        rates: c.rates,
        updatedAt: c.updatedAt,
      })),
    };
  }
  async html(html: string) {
    return this.prisma.$transaction(
      async (client) => {
        const meta = runtime.hunterSeedMetadata;
        const captures = await client.offersHunterCapture.findMany({
          select: { captureDate: true, rates: true },
          orderBy: { captureDate: 'asc' },
        });
        if (!captures.length)
          return core.renderHtml(
            html,
            runtime.getHunterSeed(),
            meta,
            await this.status(client),
          );
        const dates = captures
          .filter((c) => core.withinWindow(c.captureDate))
          .map((c) => c.captureDate);
        const current = await client.offersHunterCapture.findMany({
          where: { captureDate: { in: dates } },
          select: { payload: true },
        });
        const rows = current.flatMap((c) => JSON.parse(c.payload));
        const metadata = {
          ...meta,
          id: 'cazador-api-postgres',
          file: 'API privada del cazador',
          firstCaptureDate: captures[0].captureDate,
          captureDate: captures.at(-1)!.captureDate,
          rates: captures.reduce((n, c) => n + c.rates, 0),
          snapshots: captures.map((c) => ({
            captureDate: c.captureDate,
            rates: c.rates,
            file: 'API privada',
            dataFile: '',
          })),
        };
        return core.renderHtml(html, rows, metadata, await this.status(client));
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
}
