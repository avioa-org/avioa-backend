import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RequestPointsDto } from '../dto/request-points';
import { PointsGateway } from '../gateway/points.gateway';
import {
  NotificationType,
  PointRequestStatus,
  PointTransactionType,
} from 'generated/prisma/enums';
import { includes } from 'zod';
import { ApprovePointRequestDto } from '../dto/approve-point-request.dto';
import { RejectPointRequestDto } from '../dto/reject-point-request.dto';

@Injectable()
export class PointRequestService {
  private readonly logger = new Logger(PointRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsGateway: PointsGateway,
  ) {}

  public async request(userId: string, requestPointsDto: RequestPointsDto) {
    this.logger.debug(requestPointsDto);
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new BadRequestException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const leader = await this.prisma.user.findUnique({
      where: { userId: requestPointsDto.leaderId },
    });

    if (!leader) {
      this.logger.error(
        `Leader with id ${requestPointsDto.leaderId} not found`,
      );
      throw new NotFoundException({
        message: `El lider con el id ${requestPointsDto.leaderId} no existe`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    if (!['LEADER', 'MANAGER', 'ADMIN'].includes(leader.role)) {
      this.logger.error(
        `Leader with id ${requestPointsDto.leaderId} is not a leader or manager`,
      );
      throw new BadRequestException({
        message: `El lider con el id ${requestPointsDto.leaderId} no es un lider o manager`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    const pointRequest = await this.prisma.pointRequest.create({
      data: {
        userId,
        leaderId: requestPointsDto.leaderId,
        points: requestPointsDto.amount,
        action: requestPointsDto.reason,
        status: PointRequestStatus.PENDING,
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
        leader: {
          select: { name: true, email: true },
        },
      },
    });

    const notificationData = {
      type: NotificationType.POINT_REQUEST,
      title: 'Nueva solicitud de puntos',
      message: `${user.name} solicitó ${requestPointsDto.amount} puntos`,
      requestId: pointRequest.pointRequestId,
      requestDetails: {
        userId,
        userName: user.name,
        amount: requestPointsDto.amount,
        createdAt: pointRequest.createdAt,
      },
    };

    // Se emite por ws
    this.pointsGateway.notifyLeader(
      requestPointsDto.leaderId,
      'point_request_received',
      notificationData,
    );

    // se crea la notificación en la bd
    await this.prisma.notification.create({
      data: {
        userId: requestPointsDto.leaderId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
      },
    });

    // Se notifica por email, despues lo hago

    return {
      success: true,
      message: 'Solicitud enviada al líder',
      requestId: pointRequest.pointRequestId,
      data: pointRequest,
    };
  }

  public async getPendingRequests(leaderId: string) {
    const leader = await this.prisma.user.findUnique({
      where: { userId: leaderId },
    });

    if (!leader) {
      this.logger.error(`Leader with id ${leaderId} not found`);
      throw new NotFoundException({
        message: `El lider con el id ${leaderId} no existe`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    if (!['LEADER', 'MANAGER', 'ADMIN'].includes(leader.role)) {
      this.logger.error(
        `Leader with id ${leaderId} is not a leader or manager`,
      );
      throw new BadRequestException({
        message: `El lider con el id ${leaderId} no es un lider o manager`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    const pendingPointsRequests = await this.prisma.pointRequest.findMany({
      where: { leaderId, status: 'PENDING' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return {
      success: true,
      data: pendingPointsRequests,
      message: 'Solicitudes pendientes de aprobación',
    };
  }

  public async approvePointRequest(
    leaderId: string,
    pointRequestId: string,
    approvePointRequestDto: ApprovePointRequestDto,
  ) {
    const { decision } = approvePointRequestDto;

    const pointRequest = await this.prisma.pointRequest.findUnique({
      where: { pointRequestId, status: 'PENDING' },
      include: {
        user: {
          select: { name: true, email: true },
        },
        leader: true,
      },
    });

    if (!pointRequest) {
      this.logger.error(`Point request with id ${pointRequestId} not found`);
      throw new BadRequestException({
        message: `La solicitud de puntos con el id: ${pointRequestId} no existe o no está en pendiente de aprobación`,
        error: 'POINT_REQUEST_NOT_FOUND',
      });
    }

    if (pointRequest.leaderId !== leaderId) {
      this.logger.error(
        `Leader with id ${leaderId} is not the leader of the point request with id ${pointRequestId}`,
      );
      throw new BadRequestException({
        message: `El lider con el id ${leaderId} no es el lider de la solicitud de puntos con el id ${pointRequestId}`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    if (pointRequest.status !== PointRequestStatus.PENDING) {
      this.logger.error(
        `Point request with id ${pointRequestId} is not in pending status`,
      );
      throw new BadRequestException({
        message: `La solicitud de puntos con el id: ${pointRequestId} no esta en pendiente de aprobación`,
        error: 'POINT_REQUEST_NOT_FOUND',
      });
    }

    const updatedRequest = await this.prisma.pointRequest.update({
      where: { pointRequestId },
      data: {
        status: PointRequestStatus.APPROVED,
        decision: decision || null,
        reviewedAt: new Date(),
      },
    });

    const wallet = await this.prisma.pointWallet.findUnique({
      where: { userId: pointRequest.userId },
    });

    const newBalance = (wallet?.total || 0) + pointRequest.points;

    await this.prisma.pointTransaction.create({
      data: {
        userId: pointRequest.userId,
        pointRequestId,
        type: PointTransactionType.EARN,
        points: pointRequest.points,
        balanceAfter: newBalance,
      },
    });

    await this.prisma.pointWallet.upsert({
      where: { userId: pointRequest.userId },
      create: {
        userId: pointRequest.userId,
        total: pointRequest.points,
      },
      update: {
        total: newBalance,
      },
    });

    const notificationData = {
      type: 'POINT_APPROVAL',
      title: 'Solicitud aprobada',
      message: `Tu solicitud de ${pointRequest.points} puntos fue aprobada`,
      points: pointRequest.points,
      newBalance,
    };

    this.pointsGateway.notifyEmployee(
      pointRequest.userId,
      'point_request_approved',
      notificationData,
    );

    await this.prisma.notification.create({
      data: {
        userId: pointRequest.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: 'POINT_APPROVAL',
      },
    });

    // Email despues lo implemento
    // await this.emailService.sendEmail(
    //   pointRequest.user.email,
    //   'Solicitud de puntos aprobada',
    //   `Tu solicitud de ${pointRequest.points} puntos fue aprobada`,
    // );

    return {
      success: true,
      data: updatedRequest,
      message: 'Solicitud de puntos aprobada exitosamente',
    };
  }

  public async rejectPointRequest(
    leaderId: string,
    pointRequestId: string,
    rejectPointRequestDto: RejectPointRequestDto,
  ) {
    const { reason } = rejectPointRequestDto;

    const pointRequest = await this.prisma.pointRequest.findUnique({
      where: { pointRequestId, status: 'PENDING' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!pointRequest) {
      this.logger.error(`Point request with id ${pointRequestId} not found`);
      throw new BadRequestException({
        message: `La solicitud de puntos con el id: ${pointRequestId} no existe o no está en pendiente de aprobación`,
        error: 'POINT_REQUEST_NOT_FOUND',
      });
    }

    if (pointRequest.leaderId !== leaderId) {
      this.logger.error(
        `Leader with id ${leaderId} is not the leader of the point request with id ${pointRequestId}`,
      );
      throw new BadRequestException({
        message: `El lider con el id ${leaderId} no es el lider de la solicitud de puntos con el id ${pointRequestId}`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    await this.prisma.pointRequest.update({
      where: { pointRequestId },
      data: {
        status: PointRequestStatus.REJECTED,
        decision: reason,
        reviewedAt: new Date(),
      },
    });

    const notificationData = {
      type: 'POINT_REJECTION',
      title: 'Solicitud rechazada',
      message: `Tu solicitud de puntos fue rechazada. Razón: ${reason}`,
      reason,
    };

    this.pointsGateway.notifyEmployee(
      pointRequest.userId,
      'point_request_rejected',
      notificationData,
    );

    await this.prisma.notification.create({
      data: {
        userId: pointRequest.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: 'POINT_REJECTION',
      },
    });

    // Email despues lo implemento
    // await this.emailService.sendEmail(
    //   pointRequest.user.email,
    //   'Solicitud de puntos rechazada',
    //   `Tu solicitud de ${pointRequest.points} puntos fue rechazada. Razón: ${reason}`,
    // );

    return {
      success: true,
      message: 'Solicitud rechazada',
    };
  }

  public async getPendingRequest(leaderId: string, pointRequestId: string) {
    this.logger.debug('pointRequestId', pointRequestId);
    const pointRequest = await this.prisma.pointRequest.findUnique({
      where: { pointRequestId, status: 'PENDING' },
      include: {
        user: {
          select: { name: true, email: true },
        },
        leader: true,
      },
    });

    if (!pointRequest) {
      this.logger.error(`Point request with id ${pointRequestId} not found`);
      throw new BadRequestException({
        message: `La solicitud de puntos con el id: ${pointRequestId} no existe o no está en pendiente de aprobación`,
        error: 'POINT_REQUEST_NOT_FOUND',
      });
    }

    if (pointRequest.leaderId !== leaderId) {
      this.logger.error(
        `Leader with id ${leaderId} is not the leader of the point request with id ${pointRequestId}`,
      );
      throw new BadRequestException({
        message: `El lider con el id ${leaderId} no es el lider de la solicitud de puntos con el id ${pointRequestId}`,
        error: 'LEADER_NOT_FOUND',
      });
    }

    return {
      success: true,
      data: pointRequest,
      message: 'Solicitud de puntos pendiente de aprobación',
    };
  }

  public async approveRequest(pointRequestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pointRequest = await tx.pointRequest.findFirst({
        where: { pointRequestId, status: 'PENDING' },
      });

      if (!pointRequest) {
        this.logger.error(`Point request with id ${pointRequestId} not found`);
        throw new BadRequestException({
          message: `La solicitud de puntos con el id: ${pointRequestId} no existe o no está en pendiente de aprobación`,
          error: 'POINT_REQUEST_NOT_FOUND',
        });
      }

      await tx.pointWallet.update({
        where: { userId: pointRequest.userId },
        data: {
          total: {
            increment: pointRequest.points,
          },
        },
      });

      await tx.pointRequest.update({
        where: { pointRequestId },
        data: {
          status: 'APPROVED',
        },
      });

      return {
        message: 'Solicitud de puntos aprobada exitosamente',
      };
    });
  }

  public async getMyRequests(userId: string) {
    const pointRequests = await this.prisma.pointRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: pointRequests,
      message: 'Solicitudes de puntos obtenidas exitosamente',
    };
  }
}
