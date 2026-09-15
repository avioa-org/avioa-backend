import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { Periodo } from './utils/periodo.util';

export interface FiltrosNomina {
  desde: string; // YYYY-MM-DD
  hasta: string;
  userId?: string;
  tipos?: string[]; // LeaveType[] + 'HORAS_EXTRA'
  area?: string;
  department?: string;
  legalEntity?: string;
  office?: string;
  leaderId?: string;
  soloRemuneradas?: boolean;
}

const USER_SELECT = {
  userId: true,
  name: true,
  documentNumber: true,
  position: true,
  area: true,
  department: true,
  legalEntity: true,
  office: true,
} as const;

@Injectable()
export class NominaService {
  private readonly logger = new Logger(NominaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parsePeriodo(desde: string, hasta: string): Periodo {
    const [ys, ms, ds] = desde.split('-').map(Number);
    const [ye, me, de] = hasta.split('-').map(Number);
    const inicio = new Date(ys, ms - 1, ds);
    const fin = new Date(ye, me - 1, de);
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);
    return { desde: inicio, hasta: fin };
  }
}
