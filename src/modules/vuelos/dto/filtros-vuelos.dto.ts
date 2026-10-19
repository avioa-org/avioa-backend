import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FiltroVuelosDto {
  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  @IsString()
  destino?: string;

  @IsOptional()
  @IsString()
  aerolinea?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  solo_gangas?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  horas?: number; // ultimas X horas

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  precio_max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  precio_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  max_escalas?: number; // 0 = directo, 1, 2

  @IsOptional()
  @IsString()
  fecha_ida_desde?: string;

  @IsOptional()
  @IsString()
  fecha_ida_hasta?: string;
}
