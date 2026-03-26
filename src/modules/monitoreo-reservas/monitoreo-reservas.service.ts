import { Injectable, Logger } from '@nestjs/common';
import { Operaciones } from 'generated/prisma/client';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { GmailService } from 'src/infrastructure/gmail/gmail.infra';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RedisConnection } from 'src/infrastructure/queue/redis.connection';
import { SheetsService } from 'src/infrastructure/sheets/sheets.service';

const CONFIG = {
  MAX_THREADS: 25,
  MINUTOS_LIMITE: 15,
  INTERVALO_RECORDATORIO: 30,
  MAX_ALERTAS: 3,
  PALABRAS_RESERVA: ['solicitud reserva tiquete', 'solicitud reserva plan'],
  PALABRAS_EMITIDO: ['emitido', 'emitida', 'egreso', 'emisión', 'emision'],
};

const REDIS_KEYS = {
  LAST_RUN: 'OP_LAST_RUN_EPOCH',
  CURSOR: 'OP_CURSOR',
};

// Columnas del Sheet (1-indexed)
const COL = {
  THREAD_ID: 1,
  TIPO: 2,
  ESTADO: 3,
  FECHA_INICIO: 4,
  FECHA_ULT_ALERTA: 5,
  FECHA_EMISION: 6,
  ASUNTO: 7,
  CLIENTE: 8,
  CANTIDAD_ALERTAS: 9,
  MINUTOS_PENDIENTE: 10,
};

interface Alerta {
  motivo: string;
  asunto: string;
  cliente: string;
  minutos: number | string;
}

@Injectable()
export class MonitoreoReservasService {
  private readonly logger = new Logger(MonitoreoReservasService.name);

  constructor(
    private readonly gmailService: GmailService,
    private readonly sheetsService: SheetsService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly redisConn: RedisConnection,
    private readonly prisma: PrismaService,
  ) {}

  public async procesarAlertas() {
    const startTime = Date.now();
    const ahora = new Date();
    const gmail = this.gmailService.getClient();
    const redis = this.redisConn.getClient();

    // 1. Leer cursor y lastRun desde redis
    const lastRunStr = await redis.get(REDIS_KEYS.LAST_RUN);
    const lasRun = parseInt(lastRunStr ?? '0');
    const cursor = parseInt((await redis.get(REDIS_KEYS.CURSOR)) ?? '0');

    // 2. Carfar todas las operaciones
    const operaciones = await this.prisma.operaciones.findMany();
    const estadosMap = new Map<string, Operaciones>(
      operaciones.map((op) => [op.thread_id, op]),
    );
    this.logger.log(`Operaciones en BD: ${estadosMap.size}`);

    // 3. Cargar indice del sheet
    const sheetIndex = this.sheetsService.getRowIndex();

    // 4. Construir query de Gmail
    const epochConMargen = Math.max(0, lasRun - 7200);
    const query = `in:inbox "cordial saludo" ("solicitud reserva tiquete" OR "solicitud reserva plan") -subject:Re: -subject:Fwd: -subject:RV: after:${epochConMargen}`;

    const alertasPendientes: Alerta[] = [];
    const dbUpserts: Partial<Operaciones>[] = [];
    const sheetAppends: any[][] = [];
    const sheetUpdates: { row: number; col: number; value: any }[] = [];
    const maxMensajeEpoch = lasRun;

    // 5. Paginar hilos de Gmail
    while (true) {
      if (Date.now() - startTime > 5 * 60 * 1000) {
        await redis.set(REDIS_KEYS.CURSOR, String(cursor));
        this.logger.warn(`Tiempo límite. Cursor guardado en ${cursor}`);
        break;
      }

      // Listar threads
      const listRes = await gmail.users.threads.list({
        userId: 'me',
        q: query,
        maxResults: CONFIG.MAX_THREADS,
        pageToken: cursor > 0 ? String(cursor) : undefined,
      });

      const threads = listRes.data.threads ?? [];
      this.logger.log(`Gmail (cursor=${cursor}): ${threads.length} hilos`);

      if (threads.length === 0) {
        await redis.del(REDIS_KEYS.CURSOR);
        break;
      }

      // Procesar cada hilo
      for (const threadMeta of threads) {
        const threadId = threadMeta.id;

        // Obtener mensajes completos del hilo
        const threadRes = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });

        const messages = threadRes.data.messages ?? [];

        if (messages.length === 0) continue;

        const primerMsg = messages[0];
        const ultimoMsg = messages[messages.length - 1];

        const subject = this.getHeader(primerMsg, 'Subject') ?? '';
        const cliente = this.getHeader(primerMsg, 'From') ?? '';
        const ultimoMsgMs = parseInt(ultimoMsg.internalDate ?? '0');
        const fechaPrimerMsgMs = parseInt(primerMsg.internalDate ?? '0');
      }
    }
  }

  // ── Helpers de Gmail API ──────────────────────────────────────

  private getHeader(msg: any, name: string): string | null {
    return (
      msg.payload?.headers?.find(
        (h: any) => h.name.toLowerCase() === name.toLowerCase(),
      )?.value ?? null
    );
  }
}
