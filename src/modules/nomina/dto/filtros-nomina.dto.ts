import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { LeaveType } from 'generated/prisma/enums';

const TIPOS_VALIDOS = [...Object.values(LeaveType), 'HORAS_EXTRA'];

export class FiltrosNominaDto {
  @IsDateString({}, { message: 'desde debe ser una fecha válida (YYYY-MM-DD)' })
  desde!: string;

  @IsDateString({}, { message: 'hasta debe ser una fecha válida (YYYY-MM-DD)' })
  hasta!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'userId debe ser un uuid válido' })
  userId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'leaderId debe ser un uuid válido' })
  leaderId?: string;

  // Llega como "VACACIONES,INCAPACIDAD_EPS,HORAS_EXTRA" en el query string
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()) : value,
  )
  @IsArray()
  @IsIn(TIPOS_VALIDOS, {
    each: true,
    message: 'Uno o más tipos no son válidos',
  })
  tipos?: string[];

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  legalEntity?: string;

  @IsOptional()
  @IsString()
  office?: string;

  // Llega como "true"/"false" en el query string
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  soloRemuneradas?: boolean;
}
