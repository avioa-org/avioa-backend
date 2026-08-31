import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/env.config';

@WebSocketGateway({
  namespace: '/feed',
  cors: {
    origin: envs.FRONTEND_URL ?? '*',
    credentials: true,
  },
})
export class FeedGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FeedGateway.name);

  constructor(private readonly jwtService: JwtService) {
    this.server = new Server();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado del feed: ${client.data.userId}`);
  }
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.userId;

      await client.join('feed');

      this.logger.log(`Cliente conectado al feed: ${client.data.userId}`);
    } catch (error: any) {
      this.logger.warn(`Conexión rechazada: ${error.message}`);
      client.disconnect();
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!authHeader) return null;
    return authHeader.replace('Bearer ', '');
  }

  // EMISORES
  emitNewPost(post: any) {
    this.logger.log(`Nuevo post emitido: ${post.feedPostId}`);
    this.server.to('feed').emit('feed:post:new', post);
  }

  emitPostDeleted(postId: string) {
    this.server.to('feed').emit('feed:post:deleted', { postId });
  }

  emitPostUpdated(post: any) {
    this.server.to('feed').emit('feed:post:updated', post);
  }

  emitPinToggled(postId: string, pinned: boolean) {
    this.server.to('feed').emit('feed:post:pinned', { postId, pinned });
  }

  emitReaction(postId: string, reactionsCount: number) {
    this.server
      .to('feed')
      .emit('feed:post:reaction', { postId, reactionsCount });
  }

  emitNewComment(postId: string, comment: any, commentsCount: number) {
    this.logger.log(
      `Nuevo comentario emitido: ${comment.feedCommentId} para ${postId}`,
    );
    this.server
      .to('feed')
      .emit('feed:comment:new', { postId, comment, commentsCount });
  }

  emitCommentDeleted(postId: string, commentId: string, commentsCount: number) {
    this.server
      .to('feed')
      .emit('feed:comment:deleted', { postId, commentId, commentsCount });
  }
}
