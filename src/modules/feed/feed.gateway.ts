// feed.gateway.ts
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/env.config';
import { MappedComment, MappedPost, ReactionPayload } from './types/feed.types';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

@WebSocketGateway({
  namespace: '/feed',
  cors: {
    origin: envs.FRONTEND_URL ?? '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class FeedGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FeedGateway.name);
  private readonly ROOM = 'feed';

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`[connect] sin token → ${client.id}`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ userId: string }>(token);
      if (!payload?.userId) {
        this.logger.warn(`[connect] token sin userId → ${client.id}`);
        client.disconnect(true);
        return;
      }

      (client as AuthenticatedSocket).data.userId = payload.userId;
      await client.join(this.ROOM);

      this.logger.log(
        `[connect] user=${payload.userId} socket=${client.id} room=${this.ROOM}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`[connect] rechazado (${message}) → ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as AuthenticatedSocket).data?.userId;
    this.logger.log(
      userId
        ? `[disconnect] user=${userId} socket=${client.id}`
        : `[disconnect] socket=${client.id} (sin sesión)`,
    );
  }

  private extractToken(client: Socket): string | null {
    const raw =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization ||
      null;

    if (!raw || typeof raw !== 'string') return null;
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }

  emitNewPost(post: MappedPost, excludeUserId?: string) {
    this.broadcast('feed:post:new', post, excludeUserId);
  }

  emitPostUpdated(post: MappedPost) {
    this.broadcast('feed:post:updated', post);
  }

  emitPostDeleted(postId: string) {
    this.broadcast('feed:post:deleted', { postId });
  }

  emitPinToggled(postId: string, pinned: boolean) {
    this.broadcast('feed:post:pinned', { postId, pinned });
  }

  emitReaction(postId: string, payload: ReactionPayload) {
    this.broadcast('feed:post:reaction', { postId, ...payload });
  }

  emitNewComment(
    postId: string,
    comment: MappedComment,
    commentsCount: number,
  ) {
    this.broadcast('feed:comment:new', {
      postId,
      comment,
      commentsCount,
      parentId: comment.parentId ?? null,
    });
  }

  emitCommentDeleted(
    postId: string,
    commentId: string,
    parentId: string | null,
    commentsCount: number,
  ) {
    this.broadcast('feed:comment:deleted', {
      postId,
      commentId,
      parentId,
      commentsCount,
    });
  }
  s;
  private broadcast(event: string, payload: unknown, excludeUserId?: string) {
    const room = this.server.to(this.ROOM);

    if (excludeUserId) {
      this.server
        .in(this.ROOM)
        .fetchSockets()
        .then((sockets) => {
          for (const s of sockets) {
            if ((s.data as { userId?: string })?.userId === excludeUserId)
              continue;
            s.emit(event, payload);
          }
        });
      return;
    }

    room.emit(event, payload);
  }
}
