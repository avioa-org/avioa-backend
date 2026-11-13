import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { actionInput, Actor, Upload } from './contracts';
import {
  extractFlights,
  TravelCompositorClient,
} from './travel-compositor.client';
import { GoogleSheetClient } from './google-sheet.client';
import { parseOffersCsv } from './domain/csv';
import {
  adjustDriveInventory,
  afterCutover,
  driveInventorySignature,
  parseDriveBlocks,
} from './domain/flight-blocking-drive';
import {
  Block,
  BlockData,
  FlightSource,
  flightSignature,
  summarizeBlocks,
} from './domain/flight-blockings';
import {
  attachSplits,
  splitContext,
  splitKey,
  validateSplits,
} from './domain/flight-splits';
import { attachFlightReviews } from './domain/flight-reviews';
import { attachFlightArrival } from './domain/flight-inbox';

type Tx = Prisma.TransactionClient;
const SHEET = '1NEyuaFSPM0gymMETM_fxMHI8VWDIVoRmvPT73tdOpWU';
const iso = (date: Date | null) => date?.toISOString() ?? null;
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(),
  );
const json = (data: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;

@Injectable()
export class FlightBlockingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tc: TravelCompositorClient,
    private readonly google: GoogleSheetClient,
  ) {}

  private async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // Ejecutamos el bloqueo de Postgres, pero con "SELECT 1" al final para evitar el error de 'void'
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(170113, 8041);`;
        return fn(tx);
      },
      { maxWait: 15000, timeout: 120000 },
    );
  }

  private async sheet() {
    const checkedAt = new Date().toISOString();
    const url = new URL(
      `https://docs.google.com/spreadsheets/d/${SHEET}/export`,
    );
    url.searchParams.set('format', 'csv');
    url.searchParams.set('gid', '985693555');
    url.searchParams.set('range', 'A1:V981');
    let response: Response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo descargar el Sheet de bloqueos.',
      );
    }
    if (response.status === 401 || response.status === 403) {
      return {
        checkedAt,
        blocks: parseDriveBlocks(
          await this.google.readAuthenticated(985693555, "A1:V981"),
          checkedAt,
        ),
      };
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        `Google Sheets respondió HTTP ${response.status}.`,
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new ServiceUnavailableException('Google no devolvió contenido.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000)
          throw new ServiceUnavailableException('El CSV excede 2 MB.');
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (/^\s*</.test(text))
      return {
        checkedAt,
        blocks: parseDriveBlocks(
          await this.google.readAuthenticated(985693555, "A1:V981"),
          checkedAt,
        ),
      };
    try {
      return {
        checkedAt,
        blocks: parseDriveBlocks(parseOffersCsv(text), checkedAt),
      };
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo interpretar BLOQUEOS JET SMART. Comprueba permisos y estructura del Sheet.',
      );
    }
  }

  private async event(
    tx: Tx,
    action: string,
    data: unknown,
    by: string,
    blockId: string | null = null,
    serviceId: string | null = null,
  ) {
    return tx.flightBlockingEvent.create({
      data: { action, data: json(data), by, blockId, serviceId },
    });
  }

  private async snapshot(tx: Tx) {
    const [saved, sourceRows, links, splitRows, reviews, files, events, sync] =
      await Promise.all([
        tx.flightBlocking.findMany({ orderBy: { id: 'asc' } }),
        tx.flightBlockingService.findMany({ orderBy: { id: 'asc' } }),
        tx.flightBlockingLink.findMany(),
        tx.flightBlockingSplit.findMany({ orderBy: { key: 'asc' } }),
        tx.flightBlockingReview.findMany({ orderBy: { key: 'asc' } }),
        tx.flightBlockingAttachment.findMany({
          select: {
            id: true,
            blockId: true,
            kind: true,
            name: true,
            by: true,
            at: true,
          },
          orderBy: { at: 'desc' },
        }),
        tx.flightBlockingEvent.findMany({
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
          take: 250,
        }),
        tx.flightBlockingSync.findUnique({ where: { id: 1 } }),
      ]);
    const blocks: Block[] = saved
      .filter((b) => !b.deletedAt)
      .map((b) => ({
        id: b.id,
        code: b.code,
        title: b.title,
        departDate: b.departDate,
        returnDate: b.returnDate,
        departTime: b.departTime,
        returnTime: b.returnTime,
        origin: b.origin,
        destination: b.destination,
        flight: b.flight,
        capacity: b.capacity,
        notes: b.notes,
        aliases: b.aliases,
        revision: b.revision,
        ...(b.source === 'manual' ? { source: 'manual' as const } : {}),
        ...(b.drive
          ? { drive: b.drive as unknown as NonNullable<BlockData['drive']> }
          : {}),
        paidAt: iso(b.paidAt),
        paidBy: b.paidBy,
        namesAt: iso(b.namesAt),
        namesBy: b.namesBy,
        namesSignature: b.namesSignature,
      }));
    const sources = sourceRows.map((row) => ({
      ...(row.data as unknown as FlightSource),
      ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
    }));
    const summary = summarizeBlocks(blocks, sources, links, today());
    const splitServices = attachSplits(
      summary.services,
      splitRows.map((row) => ({
        serviceId: row.key,
        data: JSON.stringify({
          splits: row.splits,
          signature: row.signature,
          revision: row.revision,
        }),
        by: row.by,
        at: row.at.toISOString(),
      })),
    );
    for (const block of summary.blocks) {
      const parts = splitServices.filter(
        (s) => s.blockId === block.id && s.splitRevision && !s.cancelled,
      );
      if (parts.length) {
        block.signature = JSON.stringify([
          block.signature,
          parts.map((s) => [s.id, s.splitRevision, s.splitStale]),
        ]);
        block.namesComplete =
          !!block.namesAt &&
          block.namesSignature === block.signature &&
          block.unresolved === 0 &&
          !parts.some((s) => s.splitStale);
        block.namesAlert = !block.namesComplete && block.namesDue <= today();
      }
    }
    summary.alerts = summary.blocks.flatMap((b) => [
      ...(b.paymentAlert
        ? [{ blockId: b.id, kind: 'payment', due: b.paymentDue }]
        : []),
      ...(b.namesAlert
        ? [{ blockId: b.id, kind: 'names', due: b.namesDue }]
        : []),
    ]);
    const integrationAt =
      sync?.integrationAt.toISOString() ?? new Date().toISOString();
    const services = attachFlightArrival(
      attachFlightReviews(
        splitServices,
        reviews.map((row) => ({
          serviceId: row.key,
          data: JSON.stringify({ signature: row.signature }),
          by: row.by,
          at: row.at.toISOString(),
        })),
      ),
      integrationAt,
    );
    return {
      ...summary,
      services,
      integrationAt,
      today: today(),
      references: [],
      edit: true,
      admin: true,
      drive: {
        source: 'BLOQUEOS JET SMART',
        checkedAt: iso(sync?.sheetCheckedAt ?? null) ?? '',
        error: sync?.error ?? null,
      },
      files: files.map((f) => ({ ...f, at: f.at.toISOString() })),
      events: events.map((e) => ({
        ...e,
        data: JSON.stringify(e.data),
        at: e.at.toISOString(),
      })),
      sync: {
        configured: !!(
          process.env.TC_API_USERNAME &&
          process.env.TC_API_PASSWORD &&
          process.env.TC_API_MICROSITE
        ),
        lastSuccess: iso(sync?.lastSuccess ?? null),
        pending: false,
        error: sync?.error ?? null,
      },
    };
  }

  private async persistAlerts(tx: Tx) {
    const board = await this.snapshot(tx);
    const old = await tx.flightBlockingAlert.findMany();
    const live = new Set(board.blocks.map((b) => b.id));
    for (const row of old)
      if (!live.has(row.blockId) && row.active)
        await tx.flightBlockingAlert.update({
          where: { id: row.id },
          data: { active: false, resolvedAt: new Date() },
        });
    for (const block of board.blocks)
      for (const kind of ['payment', 'names'] as const) {
        const active =
          kind === 'payment' ? block.paymentAlert : block.namesAlert;
        const due = kind === 'payment' ? block.paymentDue : block.namesDue;
        const previous = old.find(
          (row) => row.blockId === block.id && row.kind === kind,
        );
        const resolvedAt = active ? null : (previous?.resolvedAt ?? new Date());
        await tx.flightBlockingAlert.upsert({
          where: { blockId_kind: { blockId: block.id, kind } },
          create: { blockId: block.id, kind, due, active, resolvedAt },
          update: { due, active, resolvedAt },
        });
      }
    return board;
  }

   async getBoard(actor: Actor) {
    const started = new Date();
    try {
      // 1. Descargar el Excel
      const sheet = await this.sheet();
      
      const oldest = await this.prisma.flightBlocking.aggregate({
        _min: { departDate: true },
      });
      const dates = [
        ...sheet.blocks.map((b) => b.departDate),
        oldest._min.departDate || "",
      ]
        .filter(Boolean)
        .sort();
      const departureFrom = process.env.TC_DEPARTURE_FROM || dates[0] || today();

      // 2. Intentar conectar con Travel Compositor (con timeout de 10s)
      let tc: { trips: any[]; checkedAt: string };
      try {
        tc = await Promise.race([
          this.tc.fetchAll(departureFrom),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT_TC")), 10000),
          ),
        ]);
      } catch (error: any) {
        console.warn(`⚠️ Travel Compositor falló o tardó demasiado (${error.message}). Continuando solo con el Excel.`);
        tc = { trips: [], checkedAt: new Date().toISOString() };
      }

      const sources = extractFlights(tc.trips);

      // 3. Guardar en base de datos (transacción segura)
      const board = await this.transaction(async (tx) => {
        const sync = await tx.flightBlockingSync.findUnique({
          where: { id: 1 },
        });
        if (sync?.lastSuccess && sync.lastSuccess > started)
          throw new ConflictException(
            "Otra sincronización más reciente terminó. Reintenta el GET.",
          );
          
        const cutover = process.env.FLIGHT_BLOCKINGS_INTEGRATION_AT
          ? new Date(process.env.FLIGHT_BLOCKINGS_INTEGRATION_AT)
          : started;
        if (!Number.isFinite(cutover.getTime()))
          throw new BadRequestException("FLIGHT_BLOCKINGS_INTEGRATION_AT inválido.");
          
        await tx.flightBlockingSync.upsert({
          where: { id: 1 },
          create: { id: 1, integrationAt: cutover },
          update: {},
        });

        // Guardar reservas de TC (si hubo)
        const oldSources = new Map(
          (await tx.flightBlockingService.findMany()).map((row) => [row.id, row]),
        );
        for (const source of sources) {
          const old = oldSources.get(source.id);
          if (source.status === "OUT_OF_SCOPE" && !old) continue;
          if (old && old.avi !== source.avi) continue; 
          if (old && isDeepStrictEqual(old.data, json(source))) continue;
          
          await tx.flightBlockingService.upsert({
            where: { id: source.id },
            create: { id: source.id, avi: source.avi, source: "tc", data: json(source), sourceAt: new Date(source.sourceAt) },
            update: { avi: source.avi, data: json(source), sourceAt: new Date(source.sourceAt) },
          });
        }

        // Guardar los bloqueos del Excel
        const existingBlocks = await tx.flightBlocking.findMany();
        const findExisting = (incoming: (typeof sheet.blocks)[number]) =>
          existingBlocks.find((b) => b.id === incoming.id) ||
          existingBlocks.find((b) => b.code === incoming.code && b.source === "drive") ||
          existingBlocks.find((b) => b.code === incoming.code && b.departDate === incoming.departDate);

        for (const incoming of sheet.blocks) {
          const existing = findExisting(incoming);
          if (existing?.deletedAt) continue;

          const data = {
            code: incoming.code,
            title: incoming.title,
            departDate: incoming.departDate,
            returnDate: incoming.returnDate,
            departTime: incoming.departTime,
            returnTime: incoming.returnTime,
            origin: incoming.origin,
            destination: incoming.destination,
            flight: incoming.flight,
            capacity: existing?.capacity ?? null,
            notes: existing?.notes ?? incoming.notes,
            aliases: existing?.aliases ?? [],
            source: "drive",
            drive: json(incoming.drive),
            updatedBy: "Google Sheets",
          };

          if (existing) {
            await tx.flightBlocking.update({
              where: { id: existing.id },
              data: { ...data, revision: { increment: 1 } },
            });
          } else {
            await tx.flightBlocking.create({ data: { id: incoming.id, ...data } });
          }
        }

        // Actualizar la fecha de sincronización
        await tx.flightBlockingSync.update({
          where: { id: 1 },
          data: {
            sheetCheckedAt: new Date(sheet.checkedAt),
            tcCheckedAt: new Date(tc.checkedAt),
            lastSuccess: new Date(),
            error: null,
          },
        });

        return this.persistAlerts(tx);
      });

      return actor.permissions.includes("flight-blockings:admin")
        ? board
        : this.publicBoard(board);
        
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      
      console.warn("Error en la sincronización principal, devolviendo solo datos locales:", error);
      
      // Si falla la sincronización global, al menos devolvemos lo que ya está en Postgres
      try {
        const board = await this.prisma.$transaction(async (tx) => {
          return this.snapshot(tx);
        });
        return actor.permissions.includes("flight-blockings:admin")
          ? board
          : this.publicBoard(board);
      } catch (innerError) {
         throw new ServiceUnavailableException(
          "No se completó la sincronización y no se pudieron leer datos locales.",
        );
      }
    }
  }

  private publicBoard(
    board: Awaited<ReturnType<FlightBlockingsService['snapshot']>>,
  ) {
    return {
      today: board.today,
      edit: false,
      admin: false,
      services: [],
      unmatched: [],
      references: [],
      alerts: [],
      files: [],
      events: [],
      drive: {
        source: 'Inventario de bloqueos',
        checkedAt: board.drive.checkedAt,
        error: null,
      },
      sync: board.sync,
      blocks: board.blocks.map((b) => ({
        id: b.id,
        code: b.code,
        title: b.title,
        departDate: b.departDate,
        returnDate: b.returnDate,
        departTime: b.departTime,
        returnTime: b.returnTime,
        origin: b.origin,
        destination: b.destination,
        flight: b.flight,
        capacity: b.capacity,
        sold: b.sold,
        netSold: b.netSold,
        available: b.available,
        oversold: b.oversold,
        ...(b.drive
          ? {
              drive: {
                available: b.drive.available,
                price: b.drive.price,
                inventoryMode: b.drive.inventoryMode,
              },
            }
          : {}),
        notes: '',
        aliases: [],
        inventoryUnresolved: b.available === null ? 1 : 0,
      })),
    };
  }

  async handleAction(input: unknown, actor: Actor) {
    const parsed = actionInput.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        error: 'Acción inválida.',
        details: parsed.error.flatten(),
      });
    const p = parsed.data,
      by = actor.email;
    return this.transaction(async (tx) => {
      const board = await this.snapshot(tx);
      const requireBlock = (id: string, revision?: number) => {
        const b = board.blocks.find((b) => b.id === id);
        if (!b || (revision !== undefined && b.revision !== revision))
          throw new ConflictException(
            'El bloqueo cambió o no existe. Actualiza antes de guardar.',
          );
        return b;
      };
      if (p.action === 'saveBlock' || p.action === 'importBlocks') {
        const rows = p.action === 'saveBlock' ? [p.data] : p.rows;
        const seen = new Set<string>();
        for (const row of rows) {
          const key = row.code + '|' + row.departDate;
          if (seen.has(key))
            throw new ConflictException('Bloqueo duplicado en el archivo.');
          seen.add(key);
        }
        for (const row of rows) {
          const id = p.action === 'saveBlock' ? p.id : undefined;
          const old = id
            ? board.blocks.find((block) => block.id === id)
            : undefined;
          if (
            p.action === 'saveBlock' &&
            ((old && p.revision !== old.revision) ||
              (!old && p.revision !== undefined))
          )
            throw new ConflictException(
              'El bloqueo cambió. Actualiza antes de guardar.',
            );
          if (old?.drive)
            throw new BadRequestException(
              'Usa ajuste de inventario para un bloqueo de Drive.',
            );
          const duplicate = await tx.flightBlocking.findUnique({
            where: {
              code_departDate: { code: row.code, departDate: row.departDate },
            },
          });
          if (duplicate && duplicate.id !== id)
            throw new ConflictException(
              'Ya existe ese código en la fecha seleccionada.',
            );
          const reopened =
            !!old &&
            (old.departDate !== row.departDate ||
              old.capacity !== row.capacity);
          const data = {
            ...row,
            source: 'manual',
            updatedBy: by,
            ...(reopened
              ? {
                  paidAt: null,
                  paidBy: null,
                  namesAt: null,
                  namesBy: null,
                  namesSignature: null,
                }
              : {}),
          };
          const saved = old
            ? await tx.flightBlocking.update({
                where: { id: old.id },
                data: { ...data, revision: { increment: 1 } },
              })
            : await tx.flightBlocking.create({
                data: { ...(id ? { id } : {}), ...data },
              });
          await this.event(
            tx,
            old ? 'edit_block' : 'create_block',
            { data: row, reopened },
            by,
            saved.id,
          );
        }
      } else if (p.action === 'adjustDriveInventory') {
        const block = requireBlock(p.blockId);
        if (
          !block.drive ||
          p.inventorySignature !== driveInventorySignature(block)
        )
          throw new ConflictException(
            'Los cupos o fechas cambiaron. Actualiza antes del ajuste.',
          );
        let data: BlockData;
        try {
          data = adjustDriveInventory(block, p, by, new Date().toISOString());
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Ajuste inválido.',
          );
        }
        await tx.flightBlocking.update({
          where: { id: block.id },
          data: {
            capacity: data.capacity,
            drive: json(data.drive),
            revision: { increment: 1 },
            updatedBy: by,
            paidAt: null,
            paidBy: null,
            namesAt: null,
            namesBy: null,
            namesSignature: null,
          },
        });
        await this.event(
          tx,
          'adjust_inventory',
          { before: block, after: data, reason: p.reason, reopened: true },
          by,
          block.id,
        );
      } else if (p.action === 'link') {
        const block = requireBlock(p.blockId),
          service = board.services.find((s) => s.id === p.serviceId);
        if (
          !service ||
          service.cancelled ||
          service.deletedAt ||
          p.signature !== service.sourceSignature
        )
          throw new ConflictException('La reserva cambió o no está activa.');
        const source = (
          await tx.flightBlockingService.findUniqueOrThrow({
            where: { id: service.id },
          })
        ).data as unknown as FlightSource;
        const signature = flightSignature(source);
        await tx.flightBlockingLink.upsert({
          where: { serviceId: service.id },
          create: {
            serviceId: service.id,
            blockId: block.id,
            seats: p.seats,
            signature,
            by,
          },
          update: {
            blockId: block.id,
            seats: p.seats,
            signature,
            by,
            at: new Date(),
          },
        });
        await this.event(
          tx,
          'link',
          { avi: service.avi, seats: p.seats },
          by,
          block.id,
          service.id,
        );
      } else if (p.action === 'splitReservation') {
        const service = board.services.find((s) => s.id === p.serviceId);
        if (!service || service.cancelled || service.deletedAt)
          throw new ConflictException('Reserva no activa.');
        const context = splitContext(board.services, service);
        if (
          !context.ready ||
          context.total === null ||
          !service.blockId ||
          p.signature !== context.signature ||
          p.revision !== service.splitRevision
        )
          throw new ConflictException(
            'Confirma los cupos o actualiza la reserva antes de dividir.',
          );
        let splits;
        try {
          splits = validateSplits(p.splits, context.total);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'División inválida.',
          );
        }
        if (
          splits.some((part) =>
            board.services.some(
              (other) =>
                !other.cancelled &&
                other.avi !== service.avi &&
                other.blockId === service.blockId &&
                (other.avi.toUpperCase() === part.code ||
                  other.splits.some((s) => s.code === part.code)),
            ),
          )
        )
          throw new ConflictException(
            'Un código ya pertenece a otra reserva del bloqueo.',
          );
        const key = splitKey(service),
          revision = randomUUID();
        const data = {
          avi: service.avi,
          blockId: service.blockId,
          splits: json(splits),
          signature: context.signature,
          revision,
          by,
          at: new Date(),
        };
        await tx.flightBlockingSplit.upsert({
          where: { key },
          create: { key, ...data },
          update: data,
        });
        await this.event(
          tx,
          'split_reservation',
          { splits, signature: context.signature, revision },
          by,
          service.blockId,
          service.id,
        );
      } else if (p.action === 'reviewReservation') {
        const service = board.services.find((s) => s.reviewKey === p.reviewKey);
        if (
          !service ||
          service.reviewSignature !== p.signature ||
          service.reviewBlocked
        )
          throw new ConflictException(
            'Revisa la vinculación, los cupos y las divisiones antes de marcar revisada.',
          );
        await tx.flightBlockingReview.upsert({
          where: { key: p.reviewKey },
          create: { key: p.reviewKey, signature: p.signature, by },
          update: { signature: p.signature, by, at: new Date() },
        });
        await this.event(
          tx,
          'review_reservation',
          { signature: p.signature, avi: service.avi },
          by,
          service.blockId,
          service.id,
        );
      } else if (p.action === 'addManualReservation') {
        const block = requireBlock(p.blockId);
        const reference = p.reference.trim().toUpperCase();
        if (reference && !/^[A-Z0-9][A-Z0-9 _./-]{0,99}$/.test(reference))
          throw new BadRequestException('Referencia inválida.');
        const id = 'MANUAL-' + p.requestId,
          at = new Date().toISOString();
        const source: FlightSource = {
          id,
          source: 'manual',
          avi: reference || 'MAN-' + p.requestId.toUpperCase(),
          reference: block.code,
          references: [block.code],
          operator: 'Registro manual',
          passenger: p.passenger,
          advisor: p.advisor.trim(),
          date: block.departDate,
          returnDate: block.returnDate,
          origin: block.origin,
          destination: block.destination,
          flight: block.flight,
          time: block.departTime,
          seats: p.seats,
          status: 'BOOKED',
          sourceAt: at,
          createdAt: at,
        };
        const old = await tx.flightBlockingService.findUnique({
          where: { id },
        });
        if (old) {
          const previous = old.data as unknown as FlightSource;
          if (
            old.source !== 'manual' ||
            old.deletedAt ||
            ['avi', 'reference', 'date', 'seats', 'passenger', 'advisor'].some(
              (key) =>
                previous[key as keyof FlightSource] !==
                source[key as keyof FlightSource],
            )
          )
            throw new ConflictException(
              'Identificador manual usado con otros datos.',
            );
          return { ok: true };
        }
        if (
          block.departDate < today() ||
          block.available === null ||
          p.seats > block.available
        )
          throw new ConflictException(
            'No hay cupos confirmados suficientes o la salida ya pasó.',
          );
        if (
          board.services.some(
            (s) =>
              !s.cancelled &&
              s.blockId === block.id &&
              (s.avi.toUpperCase() === source.avi ||
                s.splits.some((part) => part.code === source.avi)),
          )
        )
          throw new ConflictException('Referencia ya registrada.');
        await tx.flightBlockingService.create({
          data: {
            id,
            avi: source.avi,
            source: 'manual',
            data: json(source),
            sourceAt: new Date(at),
          },
        });
        await tx.flightBlockingLink.create({
          data: {
            serviceId: id,
            blockId: block.id,
            seats: p.seats,
            signature: flightSignature(source),
            by,
          },
        });
        await this.event(tx, 'manual_reservation', source, by, block.id, id);
      } else if (p.action === 'deleteManualReservation') {
        const service = board.services.find((s) => s.id === p.serviceId);
        if (
          !service ||
          service.source !== 'manual' ||
          service.sourceSignature !== p.signature
        )
          throw new ConflictException('La reserva manual cambió o no existe.');
        const row = await tx.flightBlockingService.findUniqueOrThrow({
          where: { id: service.id },
        });
        if (row.deletedAt) return { ok: true };
        const source = row.data as unknown as FlightSource;
        await tx.flightBlockingService.update({
          where: { id: service.id },
          data: {
            deletedAt: new Date(),
            data: json({ ...source, status: 'CANCELLED' }),
          },
        });
        await this.event(
          tx,
          'delete_manual_reservation',
          { avi: service.avi },
          by,
          service.blockId,
          service.id,
        );
      } else if (p.action === 'deleteBlock') {
        const block = requireBlock(p.blockId, p.revision);
        const links = await tx.flightBlockingLink.findMany({
          where: { blockId: block.id },
        });
        if (
          board.services.some(
            (s) =>
              !s.cancelled &&
              !s.deletedAt &&
              (s.blockId === block.id ||
                links.some((link) => link.serviceId === s.id)),
          )
        )
          throw new ConflictException(
            'El bloqueo tiene reservas o vínculos activos. Revísalos antes de eliminar.',
          );
        await tx.flightBlocking.update({
          where: { id: block.id },
          data: {
            deletedAt: new Date(),
            revision: { increment: 1 },
            updatedBy: by,
          },
        });
        await this.event(
          tx,
          'delete_block',
          { code: block.code },
          by,
          block.id,
        );
      } else if (p.action === 'complete' || p.action === 'reopen') {
        const block = requireBlock(p.blockId, p.revision),
          done = p.action === 'complete';
        if (
          done &&
          p.kind === 'names' &&
          (block.unresolved ||
            block.signature !== p.signature ||
            board.services.some(
              (s) => s.blockId === block.id && !s.cancelled && s.splitStale,
            ))
        )
          throw new ConflictException(
            'Revisa cupos, firmas y divisiones antes de confirmar datos.',
          );
        const support = await tx.flightBlockingAttachment.count({
          where: { blockId: block.id, kind: p.kind },
        });
        if (
          done &&
          !support &&
          !(p.kind === 'payment'
            ? p.previousPaymentConfirmed
            : p.previousDataDeliveryConfirmed)
        )
          throw new BadRequestException(
            'Adjunta soporte o confirma expresamente la gestión anterior.',
          );
        await tx.flightBlocking.update({
          where: { id: block.id },
          data: {
            revision: { increment: 1 },
            updatedBy: by,
            ...(p.kind === 'payment'
              ? { paidAt: done ? new Date() : null, paidBy: done ? by : null }
              : {
                  namesAt: done ? new Date() : null,
                  namesBy: done ? by : null,
                  namesSignature: done ? block.signature : null,
                }),
          },
        });
        await this.event(
          tx,
          p.action + '_' + p.kind,
          {
            previousPaymentConfirmed: p.previousPaymentConfirmed,
            previousDataDeliveryConfirmed: p.previousDataDeliveryConfirmed,
          },
          by,
          block.id,
        );
      }
      await this.persistAlerts(tx);
      return {
        ok: true,
        ...(p.action === 'importBlocks' ? { imported: p.rows.length } : {}),
      };
    });
  }

  async uploadFile(
    file: Upload | undefined,
    blockId: string,
    kind: string,
    actor: Actor,
  ) {
    if (
      !file ||
      !file.buffer.length ||
      file.buffer.length > 10 * 1024 * 1024 ||
      !['payment', 'names'].includes(kind) ||
      typeof blockId !== 'string' ||
      !blockId ||
      blockId.length > 200
    )
      throw new BadRequestException(
        'Adjunta un PDF o imagen de máximo 10 MB y una gestión válida.',
      );
    const bytes = file.buffer;
    const mime =
      bytes.subarray(0, 5).toString() === '%PDF-'
        ? 'application/pdf'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? 'image/jpeg'
          : bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? 'image/png'
            : bytes.subarray(0, 4).toString() === 'RIFF' &&
                bytes.subarray(8, 12).toString() === 'WEBP'
              ? 'image/webp'
              : null;
    if (!mime || mime !== file.mimetype)
      throw new BadRequestException(
        'Firma o formato no admitido. Usa PDF, JPG, PNG o WebP.',
      );
    return this.transaction(async (tx) => {
      const block = await tx.flightBlocking.findUnique({
        where: { id: blockId },
      });
      if (!block || block.deletedAt)
        throw new NotFoundException('Bloqueo no encontrado.');
      const saved = await tx.flightBlockingAttachment.create({
        data: {
          blockId,
          kind,
          name: file.originalname.replace(/[\r\n]/g, '').slice(0, 200),
          mime,
          bytes: new Uint8Array(bytes),
          size: bytes.length,
          by: actor.email,
        },
      });
      await this.event(
        tx,
        'attachment',
        { id: saved.id, kind, name: saved.name },
        actor.email,
        blockId,
      );
      return { ok: true, id: saved.id };
    });
  }
  async downloadFile(id: string) {
    if (typeof id !== 'string' || !id || id.length > 200)
      throw new BadRequestException('Archivo inválido.');
    const file = await this.prisma.flightBlockingAttachment.findUnique({
      where: { id },
    });
    if (!file) throw new NotFoundException('Archivo no encontrado.');
    return file;
  }

  // Dentro de FlightBlockingsService

async syncFromWebhook(trips: any[]) {
  console.log(`Recibidas ${trips.length} reservas desde Webhook de TC`);
  
  // 1. Extraer la información usando la misma función que usábamos en el fetch masivo
  const sources = extractFlights(trips);

  if (sources.length === 0) {
    console.log("El webhook no contenía vuelos (transportservice vacío).");
    return;
  }

  // 2. Guardar en la base de datos
  await this.transaction(async (tx) => {
    for (const source of sources) {
      if (source.status === "OUT_OF_SCOPE") continue;
      
      await tx.flightBlockingService.upsert({
        where: { id: source.id },
        create: {
          id: source.id,
          avi: source.avi,
          source: "tc",
          data: json(source),
          sourceAt: new Date(source.sourceAt),
        },
        update: {
          avi: source.avi,
          data: json(source),
          sourceAt: new Date(source.sourceAt),
        },
      });
    }
  });
  
  console.log(`Reservas de vuelo sincronizadas correctamente desde Webhook.`);
}
}
