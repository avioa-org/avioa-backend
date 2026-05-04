import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/env.config';

@Injectable()
@WebSocketGateway({
  namespace: '/points',
  cors: {
    origin: envs.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class PointsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: envs.REDIS_HOST || 'localhost',
      port: parseInt(envs.REDIS_PORT) || 6379,
    });
  }

  async handleConnection(socket: Socket) {
    console.log('🔥 intento de conexión');
    console.log(socket.handshake.auth);
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // se va a cachear ne redis con este formato: user:{userId}:socket -> socketId
    await this.redis.set(`user:${userId}:socketId`, socket.id, 'EX', 86400); // 24 horas expira

    socket.join(`user:${userId}`);
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.handshake.auth.userId;
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
