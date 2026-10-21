import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateTransferRequestDto } from './create-transfer-request.dto';
import { UpsertTransferProviderDto } from './upsert-transfer-provider.dto';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.transferRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private validatePayload(payload: Record<string, unknown>) {
    const stringFields = [
      'reservation',
      'holder',
      'phone',
      'advisor',
      'destination',
      'hotel',
      'arrivalAirline',
      'arrivalFlight',
      'arrivalDate',
      'arrivalTime',
      'returnAirline',
      'returnFlight',
      'returnDate',
      'returnTime',
      'tourNotes',
      'notes',
    ];
    for (const field of stringFields) {
      if (typeof payload[field] !== 'string') {
        throw new BadRequestException('La solicitud tiene campos inválidos');
      }
    }
    for (const field of stringFields.slice(0, 14)) {
      if (!(payload[field] as string).trim()) {
        throw new BadRequestException('Completa todos los campos obligatorios');
      }
    }
    if (
      (payload.reservation as string).length > 60 ||
      (payload.holder as string).length > 120 ||
      (payload.hotel as string).length > 180 ||
      (payload.tourNotes as string).length > 1500 ||
      (payload.notes as string).length > 2000
    ) {
      throw new BadRequestException(
        'Uno de los campos excede el tamaño permitido',
      );
    }
    if (!/^\+?[\d\s()-]{7,25}$/.test(payload.phone as string)) {
      throw new BadRequestException('Escribe un teléfono válido');
    }
    if (
      !['Cartagena', 'Santa Marta', 'San Andrés', 'Palomino', 'Barú'].includes(
        payload.destination as string,
      )
    ) {
      throw new BadRequestException('Selecciona un destino válido');
    }
    if (
      !Number.isInteger(payload.passengers) ||
      (payload.passengers as number) < 1 ||
      (payload.passengers as number) > 100 ||
      !Number.isInteger(payload.infants) ||
      (payload.infants as number) < 0 ||
      (payload.infants as number) > 30
    ) {
      throw new BadRequestException('La cantidad de pasajeros no es válida');
    }
    if (
      typeof payload.includesTours !== 'boolean' ||
      (payload.includesTours && !(payload.tourNotes as string).trim())
    ) {
      throw new BadRequestException('Revisa la información de tours');
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const key of ['arrivalDate', 'returnDate']) {
      const value = payload[key] as string;
      if (
        !datePattern.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value
      ) {
        throw new BadRequestException('Selecciona fechas válidas');
      }
    }
    for (const key of ['arrivalTime', 'returnTime']) {
      if (!timePattern.test(payload[key] as string)) {
        throw new BadRequestException('Selecciona horas válidas');
      }
    }
    const arrival =
      String(payload.arrivalDate) + 'T' + String(payload.arrivalTime);
    const returning =
      String(payload.returnDate) + 'T' + String(payload.returnTime);
    if (returning < arrival) {
      throw new BadRequestException(
        'El regreso debe ser posterior a la llegada',
      );
    }
    if (JSON.stringify(payload).length > 100_000) {
      throw new BadRequestException('La solicitud excede el tamaño permitido');
    }
  }

  async create(userId: string, dto: CreateTransferRequestDto) {
    const payload = dto.payload;
    this.validatePayload(payload);
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.transferRequest.create({
        data: { userId, payload: payload as any },
      });
      await tx.transferRequestEvent.create({
        data: {
          transferRequestId: request.transferRequestId,
          action: 'Solicitud registrada',
        },
      });
      return request;
    });
  }

  async findMineById(userId: string, id: string) {
    const request = await this.prisma.transferRequest.findFirst({
      where: { transferRequestId: id, userId },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async updateMine(
    userId: string,
    id: string,
    dto: { payload: Record<string, unknown>; status: string; version: number },
  ) {
    if (
      !dto ||
      !dto.payload ||
      typeof dto.payload !== 'object' ||
      Array.isArray(dto.payload) ||
      !Number.isInteger(dto.version) ||
      !['PENDING', 'IN_PROGRESS', 'CONFIRMED', 'CANCELLED'].includes(dto.status)
    ) {
      throw new BadRequestException('La actualización tiene campos inválidos');
    }
    this.validatePayload(dto.payload);
    const current = await this.prisma.transferRequest.findFirst({
      where: { transferRequestId: id, userId },
      select: { transferRequestId: true, status: true, version: true },
    });
    if (!current) throw new NotFoundException('Solicitud no encontrada');
    const changed = current.status !== dto.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.transferRequest.updateMany({
        where: { transferRequestId: id, userId, version: dto.version },
        data: {
          payload: dto.payload as any,
          status: dto.status as any,
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          'La solicitud cambió en otra sesión. Actualiza e inténtalo de nuevo.',
        );
      await tx.transferRequestEvent.create({
        data: {
          transferRequestId: id,
          action: changed
            ? `Estado actualizado: ${dto.status}`
            : 'Solicitud editada',
        },
      });
      return tx.transferRequest.findFirst({
        where: { transferRequestId: id, userId },
      });
    });
    return updated;
  }

  async cancelMine(userId: string, id: string) {
    const request = await this.prisma.transferRequest.findFirst({
      where: { transferRequestId: id, userId },
      select: { transferRequestId: true, status: true },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se pueden cancelar solicitudes pendientes',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transferRequest.update({
        where: { transferRequestId: id },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      await tx.transferRequestEvent.create({
        data: { transferRequestId: id, action: 'Solicitud cancelada' },
      });
      return updated;
    });
  }

  listActiveProviders() {
    return this.prisma.transferProvider.findMany({
      where: { isActive: true },
      select: {
        providerId: true,
        destination: true,
        name: true,
        channel: true,
        contact: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  listProviders() {
    return this.prisma.transferProvider.findMany({ orderBy: { name: 'asc' } });
  }

  private validateProvider(dto: UpsertTransferProviderDto) {
    const name = dto.name.trim();
    const contact = dto.contact.trim();
    if (!name || name.length > 120 || !contact || contact.length > 350) {
      throw new BadRequestException('Completa un nombre y contacto válidos');
    }
    if (dto.channel === 'EMAIL') {
      const emails = contact.split(',').map((email) => email.trim());
      if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        throw new BadRequestException(
          'Ingresa correos válidos separados por comas',
        );
      }
    } else if (!/^\+?\d{10,15}$/.test(contact)) {
      throw new BadRequestException('Ingresa un teléfono internacional válido');
    }
  }
  createProvider(dto: UpsertTransferProviderDto) {
    this.validateProvider(dto);
    return this.prisma.transferProvider.create({
      data: {
        ...dto,
        name: dto.name.trim(),
        contact: dto.contact.trim(),
      } as any,
    });
  }

  async updateProvider(id: string, dto: UpsertTransferProviderDto) {
    this.validateProvider(dto);
    const exists = await this.prisma.transferProvider.findUnique({
      where: { providerId: id },
      select: { providerId: true },
    });
    if (!exists) throw new NotFoundException('Proveedor no encontrado');
    return this.prisma.transferProvider.update({
      where: { providerId: id },
      data: {
        ...dto,
        name: dto.name.trim(),
        contact: dto.contact.trim(),
      } as any,
    });
  }
}
