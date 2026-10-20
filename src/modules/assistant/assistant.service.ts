import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeavesService } from '../leaves/leaves.service';
import { createAssistantGraph } from './graph/assistant.graph';
import { HumanMessage } from '@langchain/core/messages';
import { Response } from 'express';
import { isAIChunk } from './utils/is-ai-chunk';
import { extractText } from './utils/extract-text';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { LeaveStatus, Role } from 'generated/prisma/enums';
import {
  AssistantActionPayload,
  PendingAssistantAction,
} from './assistant-action.types';
import { PrismaCheckpointSaver } from './graph/prisma-checkpoint.saver';
import { NominaService } from '../nomina/nomina.service';

interface PendingAssistantActionRow {
  actionId: string;
  actorId: string;
  threadId: string;
  payload: AssistantActionPayload;
  summary: string;
  state: PendingAssistantAction['state'] | 'EXECUTED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: Date;
}

@Injectable()
export class AssistantService {
  private readonly checkpointer: PrismaCheckpointSaver;

  constructor(
    private readonly leaveService: LeavesService,
    private readonly prisma: PrismaService,
    private readonly nominaService: NominaService,
  ) {
    this.checkpointer = new PrismaCheckpointSaver(prisma);
  }

  async chatStream(
    userId: string,
    role: Role,
    isLeader: boolean,
    message: string,
    res: Response,
    requestedThreadId?: string,
  ) {
    this.assertMessage(message);
    const threadId = this.resolveThreadId(requestedThreadId);
    await this.checkpointer.refreshThread(
      this.checkpointThreadId(userId, role, isLeader, threadId),
    );
    const graph = createAssistantGraph(
      this.leaveService,
      this.nominaService,
      this.prisma,
      userId,
      role,
      isLeader,
      this.checkpointer,
      threadId,
      this.proposeAction.bind(this),
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const stream = await graph.stream(
        {
          messages: [new HumanMessage(message)],
          userId,
          role,
          isLeader,
        },
        {
          streamMode: 'messages',
          configurable: {
            thread_id: this.checkpointThreadId(userId, role, isLeader, threadId),
          },
        },
      );

      for await (const chunk of stream) {
        if (Array.isArray(chunk)) {
          const [msg] = chunk;

          if (!isAIChunk(msg)) continue;

          const text = extractText(msg.content);

          if (text) {
            res.write(
              `data: ${JSON.stringify({ type: 'token', content: text })}\n\n`,
            );
          }
        } else if ((chunk as any)?.agent?.messages) {
          const last = (chunk as any).agent.messages.at(-1);
          const text = extractText(last?.content);
          if (text) {
            res.write(
              `data: ${JSON.stringify({ type: 'token', content: text })}\n\n`,
            );
          }
        }
      }

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          threadId,
          pendingActions: await this.getPendingActions(userId, threadId),
        })}\n\n`,
      );
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: 'No se pudo procesar el mensaje.',
          threadId,
          pendingActions: await this.getPendingActions(userId, threadId),
        })}\n\n`,
      );
      res.end();
    }
  }

  async chat(
    userId: string,
    role: Role,
    isLeader: boolean,
    message: string,
    requestedThreadId?: string,
  ) {
    this.assertMessage(message);
    const threadId = this.resolveThreadId(requestedThreadId);
    await this.checkpointer.refreshThread(
      this.checkpointThreadId(userId, role, isLeader, threadId),
    );
    const graph = createAssistantGraph(
      this.leaveService,
      this.nominaService,
      this.prisma,
      userId,
      role,
      isLeader,
      this.checkpointer,
      threadId,
      this.proposeAction.bind(this),
    );

    const result = await graph.invoke(
      {
        messages: [new HumanMessage(message)],
        userId,
        role,
        isLeader,
      },
      {
        configurable: {
          thread_id: this.checkpointThreadId(userId, role, isLeader, threadId),
        },
      },
    );

    const lastMessage = result.messages.at(-1);
    return {
      response:
        typeof lastMessage?.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage?.content),
      threadId,
      pendingActions: await this.getPendingActions(userId, threadId),
    };
  }

  async confirmAction(
    userId: string,
    role: Role,
    isLeader: boolean,
    actionId: string,
    confirmed: boolean,
  ) {
    const [row] = await this.prisma.$queryRaw<PendingAssistantActionRow[]>`
      SELECT action_id AS "actionId", actor_id AS "actorId", thread_id AS "threadId",
             payload, summary, state, expires_at AS "expiresAt"
      FROM assistant_pending_actions
      WHERE action_id = ${actionId} AND actor_id = ${userId}
      LIMIT 1
    `;
    if (!row) {
      throw new NotFoundException('La acción pendiente no existe.');
    }
    if (row.expiresAt.getTime() <= Date.now() || row.state === 'EXPIRED') {
      await this.prisma.$executeRaw`
        UPDATE assistant_pending_actions SET state = 'EXPIRED'
        WHERE action_id = ${actionId} AND actor_id = ${userId} AND state = 'PENDING'
      `;
      throw new GoneException('La confirmación expiró. Vuelve a solicitar la acción.');
    }
    if (row.state !== 'PENDING') {
      throw new ConflictException('La acción ya se está procesando.');
    }
    if (!confirmed) {
      const changed = await this.prisma.$executeRaw`
        UPDATE assistant_pending_actions SET state = 'CANCELLED'
        WHERE action_id = ${actionId} AND actor_id = ${userId} AND state = 'PENDING'
      `;
      if (changed !== 1) throw new ConflictException('La acción ya fue procesada.');
      return { confirmed: false, cancelled: true };
    }

    const claimed = await this.prisma.$executeRaw`
      UPDATE assistant_pending_actions SET state = 'EXECUTING'
      WHERE action_id = ${actionId} AND actor_id = ${userId}
        AND state = 'PENDING' AND expires_at > NOW()
    `;
    if (claimed !== 1) {
      throw new ConflictException('La acción expiró o ya fue procesada.');
    }

    const action: PendingAssistantAction = {
      actionId: row.actionId,
      actorId: row.actorId,
      threadId: row.threadId,
      payload: row.payload,
      summary: row.summary,
      expiresAt: row.expiresAt.getTime(),
      state: 'EXECUTING',
    };
    try {
      const result = await this.executeAction(action, role, isLeader);
      await this.prisma.$executeRaw`
        UPDATE assistant_pending_actions SET state = 'EXECUTED'
        WHERE action_id = ${actionId} AND state = 'EXECUTING'
      `;
      return { confirmed: true, result };
    } catch (error) {
      await this.prisma.$executeRaw`
        UPDATE assistant_pending_actions SET state = 'FAILED'
        WHERE action_id = ${actionId} AND state = 'EXECUTING'
      `;
      throw error;
    }
  }

  private async proposeAction(
    actorId: string,
    threadId: string,
    payload: AssistantActionPayload,
    summary: string,
  ): Promise<PendingAssistantAction> {
    const action: PendingAssistantAction = {
      actionId: randomUUID(),
      actorId,
      threadId,
      payload,
      summary,
      expiresAt: Date.now() + 5 * 60 * 1000,
      state: 'PENDING',
    };
    await this.prisma.$executeRaw`
      UPDATE assistant_pending_actions SET state = 'EXPIRED'
      WHERE actor_id = ${actorId} AND state = 'PENDING' AND expires_at <= NOW()
    `;
    await this.prisma.$executeRaw`
      INSERT INTO assistant_pending_actions (
        action_id, actor_id, thread_id, payload, summary, state, expires_at
      ) VALUES (
        ${action.actionId}, ${actorId}, ${threadId}, ${JSON.stringify(payload)}::jsonb,
        ${summary}, 'PENDING', ${new Date(action.expiresAt)}
      )
    `;
    return action;
  }

  private async getPendingActions(actorId: string, threadId: string) {
    const actions = await this.prisma.$queryRaw<
      Array<{ actionId: string; summary: string; expiresAt: Date }>
    >`
      SELECT action_id AS "actionId", summary, expires_at AS "expiresAt"
      FROM assistant_pending_actions
      WHERE actor_id = ${actorId} AND thread_id = ${threadId}
        AND state = 'PENDING' AND expires_at > NOW()
      ORDER BY created_at ASC
    `;
    return actions.map(({ actionId, summary, expiresAt }) => ({
      actionId,
      summary,
      expiresAt: expiresAt.toISOString(),
    }));
  }

  private async executeAction(
    action: PendingAssistantAction,
    role: Role,
    isLeader: boolean,
  ) {
    const { payload, actorId } = action;
    switch (payload.kind) {
      case 'CREATE_LEAVE':
        return this.leaveService.create(actorId, payload.input);
      case 'CANCEL_LEAVE':
        return this.leaveService.cancel(payload.requestId, actorId);
      case 'REVIEW_LEAVE': {
        const record = await this.prisma.leaveRequest.findUnique({
          where: { leaveRequestId: payload.requestId },
        });
        if (!record) throw new NotFoundException('Solicitud no encontrada.');
        if (
          role !== Role.ADMIN &&
          ((!isLeader && role !== Role.LEADER) || record.leaderId !== actorId)
        ) {
          throw new ForbiddenException('Ya no tienes permiso para revisar esta solicitud.');
        }
        if (record.status !== LeaveStatus.PENDING) {
          throw new ConflictException('La solicitud ya no está pendiente.');
        }
        return this.leaveService.review(record, {
          status: payload.status,
          comment: payload.comment,
        });
      }
    }
  }

  private resolveThreadId(requested?: string) {
    if (requested === undefined) return randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(requested)) {
      throw new BadRequestException(
        'threadId debe contener solo letras, números, guion o guion bajo.',
      );
    }
    return requested;
  }

  private checkpointThreadId(
    userId: string,
    role: Role,
    isLeader: boolean,
    threadId: string,
  ) {
    return `${userId}:${role}:${isLeader}:${threadId}`;
  }

  private assertMessage(message: unknown): asserts message is string {
    if (
      typeof message !== 'string' ||
      !message.trim() ||
      message.length > 8000
    ) {
      throw new BadRequestException(
        'El mensaje debe tener entre 1 y 8000 caracteres.',
      );
    }
  }
}
