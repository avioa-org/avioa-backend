import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/env.config';
import { verify } from 'jsonwebtoken';

@Injectable()
@WebSocketGateway({
  namespace: '/portal',
  cors: {
    origin: envs.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis(envs.REDIS_URL);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async handleConnection(socket: Socket) {
    const authHeader = socket.handshake.auth?.token as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader;

    if (!bearerToken) return this.reject(socket, 'missing token');

    let userId: string | undefined;
    try {
      const decoded = verify(bearerToken, envs.JWT_SECRET) as {
        userId?: string;
      };
      userId = decoded.userId;
    } catch {
      return this.reject(socket, 'invalid token');
    }

    if (!userId) return this.reject(socket, 'token without userId');

    socket.data.userId = userId;
    await socket.join(`user:${userId}`);
    this.logger.debug(`Socket connected for user ${userId}`);
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      await socket.leave(`user:${userId}`);
      this.logger.debug(`Socket disconnected for user ${userId}`);
    }
  }

  async notifyUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  async notifyUsers(userIds: string[], event: string, data: any) {
    if (!userIds.length) return;
    const rooms = userIds.map((id) => `user:${id}`);
    this.server.to(rooms).emit(event, data);
  }

  async notifyLeader(leaderId: string, event: string, data: any) {
    return this.notifyUser(leaderId, event, data);
  }

  async notifyEmployee(userId: string, event: string, data: any) {
    return this.notifyUser(userId, event, data);
  }

  async notifyHR(event: string, data: any) {
    // Aqui hay que buscar al usuario con rol RRHH
    this.server.emit(event, data);
  }

  private reject(socket: Socket, reason: string) {
    this.logger.warn(`Socket ${socket.id} rejected: ${reason}`);
    socket.disconnect();
  }
}
