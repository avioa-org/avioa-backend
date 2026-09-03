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
  namespace: '/password-vault',
  cors: {
    origin: envs.FRONTEND_URL ?? '*',
    credentials: true,
  },
})
export class PasswordVaultGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PasswordVaultGateway.name);

  constructor(private readonly jwtService: JwtService) {
    this.server = new Server();
  }
  handleDisconnect(client: Socket) {
    this.logger.log(
      `Cliente desconectado del password-vault: ${client.data.userId}`,
    );
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

      await client.join(`user:${payload.userId}`);

      if (payload.area) {
        await client.join(`area:${payload.area}`);
      }

      this.logger.log(
        `Cliente conectado al password-vault: ${client.data.userId}`,
      );
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

  emitPasswordSharedToUser(vault: any, sharedWithUserId: string) {
    this.server.to(`user:${sharedWithUserId}`).emit('password:shared', {
      passwordVaultId: vault.passwordVaultId,
    });
  }

  emitPasswordSharedToArea(vault: any, area: string) {
    this.server.to(`area:${area}`).emit('password:shared', {
      passwordVaultId: vault.passwordVaultId,
    });
  }
}
