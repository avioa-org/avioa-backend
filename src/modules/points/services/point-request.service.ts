import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class PointRequestService {
  private readonly logger = new Logger(PointRequestService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
