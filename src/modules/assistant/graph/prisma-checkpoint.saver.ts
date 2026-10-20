import { MemorySaver, WRITES_IDX_MAP } from '@langchain/langgraph-checkpoint';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

interface CheckpointRow {
  checkpointNs: string;
  checkpointId: string;
  parentCheckpointId: string | null;
  checkpointData: string;
  metadataData: string;
}

interface CheckpointWriteRow {
  checkpointNs: string;
  checkpointId: string;
  taskId: string;
  writeIndex: number;
  channel: string;
  valueData: string;
}

export class PrismaCheckpointSaver extends MemorySaver {
  private readonly loadedThreads = new Set<string>();
  private readonly loadingThreads = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async refreshThread(threadId: string) {
    delete this.storage[threadId];
    for (const key of Object.keys(this.writes)) {
      if (JSON.parse(key)[0] === threadId) delete this.writes[key];
    }
    this.loadedThreads.delete(threadId);
    await this.ensureLoaded(threadId);
  }

  override async getTuple(config: any) {
    const threadId = config.configurable?.thread_id;
    if (typeof threadId === 'string') await this.ensureLoaded(threadId);
    return super.getTuple(config);
  }

  override async *list(config: any, options?: any): AsyncGenerator<any> {
    const threadId = config.configurable?.thread_id;
    if (typeof threadId === 'string') {
      await this.ensureLoaded(threadId);
    } else {
      const threads = await this.prisma.$queryRaw<Array<{ threadId: string }>>`
        SELECT DISTINCT thread_id AS "threadId" FROM assistant_checkpoints
      `;
      await Promise.all(threads.map(({ threadId: id }) => this.ensureLoaded(id)));
    }
    yield* super.list(config, options);
  }

  override async put(config: any, checkpoint: any, metadata: any) {
    const threadId = config.configurable?.thread_id;
    if (typeof threadId !== 'string') {
      throw new Error('El checkpoint requiere configurable.thread_id.');
    }
    await this.ensureLoaded(threadId);
    const savedConfig = await super.put(config, checkpoint, metadata);
    const checkpointNs = config.configurable?.checkpoint_ns ?? '';
    const saved = this.storage[threadId][checkpointNs][checkpoint.id];
    const [checkpointData, metadataData, parentCheckpointId] = saved;
    await this.prisma.$executeRaw`
      INSERT INTO assistant_checkpoints (
        thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id,
        checkpoint_data, metadata_data
      ) VALUES (
        ${threadId}, ${checkpointNs}, ${checkpoint.id}, ${parentCheckpointId ?? null},
        ${Buffer.from(checkpointData).toString('base64')},
        ${Buffer.from(metadataData).toString('base64')}
      )
      ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id) DO UPDATE SET
        parent_checkpoint_id = EXCLUDED.parent_checkpoint_id,
        checkpoint_data = EXCLUDED.checkpoint_data,
        metadata_data = EXCLUDED.metadata_data
    `;
    return savedConfig;
  }

  override async putWrites(config: any, writes: any[], taskId: string) {
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;
    if (typeof threadId !== 'string' || typeof checkpointId !== 'string') {
      throw new Error('Las escrituras del checkpoint requieren thread_id y checkpoint_id.');
    }
    await this.ensureLoaded(threadId);
    await super.putWrites(config, writes, taskId);
    const checkpointNs = config.configurable?.checkpoint_ns ?? '';
    const storageKey = JSON.stringify([threadId, checkpointNs, checkpointId]);
    await Promise.all(
      writes.map(async ([channel]: [string, unknown], index: number) => {
        const writeIndex = WRITES_IDX_MAP[channel] ?? index;
        const stored = this.writes[storageKey]?.[`${taskId},${writeIndex}`];
        if (!stored) return;
        const [, storedChannel, value] = stored;
        await this.prisma.$executeRaw`
          INSERT INTO assistant_checkpoint_writes (
            thread_id, checkpoint_ns, checkpoint_id, task_id, write_index,
            channel, value_data
          ) VALUES (
            ${threadId}, ${checkpointNs}, ${checkpointId}, ${taskId}, ${writeIndex},
            ${storedChannel}, ${Buffer.from(value).toString('base64')}
          )
          ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id, task_id, write_index)
          DO NOTHING
        `;
      }),
    );
  }

  override async deleteThread(threadId: string) {
    await this.prisma.$executeRaw`
      DELETE FROM assistant_checkpoint_writes WHERE thread_id = ${threadId}
    `;
    await this.prisma.$executeRaw`
      DELETE FROM assistant_checkpoints WHERE thread_id = ${threadId}
    `;
    this.loadedThreads.delete(threadId);
    await super.deleteThread(threadId);
  }

  private async ensureLoaded(threadId: string) {
    if (this.loadedThreads.has(threadId)) return;
    const inFlight = this.loadingThreads.get(threadId);
    if (inFlight) return inFlight;

    const load = this.loadThread(threadId);
    this.loadingThreads.set(threadId, load);
    try {
      await load;
      this.loadedThreads.add(threadId);
    } finally {
      this.loadingThreads.delete(threadId);
    }
  }

  private async loadThread(threadId: string) {
    const [checkpoints, writes] = await Promise.all([
      this.prisma.$queryRaw<CheckpointRow[]>`
        SELECT checkpoint_ns AS "checkpointNs", checkpoint_id AS "checkpointId",
               parent_checkpoint_id AS "parentCheckpointId",
               checkpoint_data AS "checkpointData", metadata_data AS "metadataData"
        FROM assistant_checkpoints WHERE thread_id = ${threadId}
      `,
      this.prisma.$queryRaw<CheckpointWriteRow[]>`
        SELECT checkpoint_ns AS "checkpointNs", checkpoint_id AS "checkpointId",
               task_id AS "taskId", write_index AS "writeIndex", channel,
               value_data AS "valueData"
        FROM assistant_checkpoint_writes WHERE thread_id = ${threadId}
      `,
    ]);

    for (const row of checkpoints) {
      this.storage[threadId] ??= Object.create(null);
      this.storage[threadId][row.checkpointNs] ??= Object.create(null);
      this.storage[threadId][row.checkpointNs][row.checkpointId] = [
        new Uint8Array(Buffer.from(row.checkpointData, 'base64')),
        new Uint8Array(Buffer.from(row.metadataData, 'base64')),
        row.parentCheckpointId ?? undefined,
      ];
    }

    for (const row of writes) {
      const storageKey = JSON.stringify([
        threadId,
        row.checkpointNs,
        row.checkpointId,
      ]);
      this.writes[storageKey] ??= Object.create(null);
      this.writes[storageKey][`${row.taskId},${row.writeIndex}`] = [
        row.taskId,
        row.channel,
        new Uint8Array(Buffer.from(row.valueData, 'base64')),
      ];
    }
  }
}
