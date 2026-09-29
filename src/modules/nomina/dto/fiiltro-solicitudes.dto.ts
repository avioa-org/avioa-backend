import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { LeaveType } from 'generated/prisma/enums';

const TIPOS_VALIDOS = [...Object.values(LeaveType), 'HORAS_EXTRA'];
const ESTADOS_VALIDOS = [
  'PENDING_HR_VALIDATION',
  'PENDDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

function toArray({ value }: { value: unknown }) {
  if (typeof value === 'string') return value.split(',').map((v) => v.trim());
  return value;
}

export class FiltrosSolicitudesDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'userId debe ser un uuid válido' })
  userId?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  legalEntity?: string;

  // Tipos: cualquier LeaveType + el pseudo-tipo 'OVERTIME'
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(TIPOS_VALIDOS, {
    each: true,
    message: 'Uno o más tipos no son válidos',
  })
  tipos?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(ESTADOS_VALIDOS, {
    each: true,
    message: 'Uno o más estados no son válidos',
  })
  estados?: string[];

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
