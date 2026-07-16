import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from 'generated/prisma/enums';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   *
   * registra un evento de auditoria, si falla se registra el log
   */
  async record(params: {
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          description: params.description,
          metadata: params.metadata as object,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo escribir auditoría: ${params.action} sobre ${params.entityType}:${params.entityId}`,
        error as Error,
      );
    }
  }

  /**
   *
   * Para cuando alguien vio algo que no deberia ver (posible fuga)
   */
  async recordSensitiveRead(params: {
    viewerId: string;
    targetUserId: string;
    fields: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.record({
      userId: params.viewerId,
      action: AuditAction.VIEW_SENSITIVE,
      entityType: 'User',
      entityId: params.targetUserId,
      description: `Lectura de campos sensibles: ${params.fields.join(', ')}`,
      metadata: { fields: params.fields },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }
}
