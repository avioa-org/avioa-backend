import { Injectable, Logger } from '@nestjs/common';
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
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis(envs.REDIS_URL);
  }

  async handleConnection(socket: Socket) {
    const authHeader = socket.handshake.auth?.token as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader;

    if (!bearerToken) {
      this.logger.warn(`Socket ${socket.id} rejected: missing token`);
      socket.disconnect();
      return;
    }

    let userId: string | undefined;
    try {
      const decoded = verify(bearerToken, envs.JWT_SECRET) as {
        userId?: string;
      };
      userId = decoded.userId;
    } catch {
      this.logger.warn(`Socket ${socket.id} rejected: invalid token`);
      socket.disconnect();
      return;
    }

    if (!userId) {
      this.logger.warn(`Socket ${socket.id} rejected: token without userId`);
      socket.disconnect();
      return;
    }

    socket.data.userId = userId;

    // se va a cachear ne redis con este formato: user:{userId}:socket -> socketId
    await this.redis.set(`user:${userId}:socketId`, socket.id, 'EX', 86400); // 24 horas expira

    socket.join(`user:${userId}`);
    this.logger.debug(`Socket connected for user ${userId}`);
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      await this.redis.del(`user:${userId}:socketId`);
    }
  }

  // Notificar al lider
  async notifyLeader(leaderId: string, event: string, data: any) {
    const socketId = await this.redis.get(`user:${leaderId}:socketId`);

    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  // Notificar al empleado
  async notifyEmployee(userId: string, event: string, data: any) {
    const socketId = await this.redis.get(`user:${userId}:socketId`);

    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  async notifyHR(event: string, data: any) {
    // Aqui hay que buscar al usuario con rol RRHH
    this.server.emit(event, data);
  }
}
