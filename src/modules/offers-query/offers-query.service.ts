import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
const core = require('./engine.cjs');

@Injectable()
export class OffersQueryService {
  private config: any;
  constructor(private readonly prisma: PrismaService) {}

  attachSimulator(html: string) {
    const anchor = "state.view='__OFFERS_INITIAL_VIEW__';";
    if (html.split(anchor).length !== 2) throw new ServiceUnavailableException('Versión del simulador incompatible.');
    return html.replace(anchor, () => readFileSync(join(__dirname, 'simulator.js'), 'utf8') + '\n' + anchor);
  }

  async model() {
    if (!this.config) {
      const runtime = require(join(__dirname, '..', '..', 'infrastructure', 'offers-runtime', 'runtime.cjs'));
      this.config = core.settings(runtime.HTML);
    }
    const now = Date.now();
    // Conservative date floor; the engine enforces the exact <72h rule on every read.
    const since = new Date(now - 72 * 3600000).toISOString().slice(0, 10);
    const data = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.offersWorkspaceState.findUnique({ where: { id: 1 } });
      const captures = await tx.offersHunterCapture.findMany({ where: { captureDate: { gte: since } }, orderBy: { captureDate: 'asc' } });
      const sync = await tx.offersHunterSyncState.findUnique({ where: { id: 1 }, select: { lastSuccessAt: true } });
      return { workspace, captures, sync };
    }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 15000 });
    if (!data.workspace) throw new ServiceUnavailableException('Importa primero las ofertas del portal.');
    return core.build({ payload: JSON.parse(data.workspace.payload), rows: data.captures.flatMap(c => JSON.parse(c.payload)), config: this.config, revision: data.workspace.revision, sync: data.sync, now: Date.now() });
  }
  async search(query: Record<string, unknown>) { core.validate(query); return core.query(await this.model(), query); }
  async detail(id: string, query: Record<string, unknown>, section = 'detalle') { core.validate(query); return core.detail(await this.model(), id, query, section); }
  async context(query: Record<string, unknown>, kind = 'contexto') { core.validate(query); return core.context(await this.model(), query, kind); }
}
