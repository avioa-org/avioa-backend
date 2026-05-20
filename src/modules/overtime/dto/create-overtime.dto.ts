import {
  ArrayMinSize,
  IsDateString,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OvertimeRequestInputDto {
  @IsDateString()
  @IsNotEmpty()
  date!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime debe tener formato HH:mm en 24h',
  })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime debe tener formato HH:mm en 24h',
  })
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;
}

export class CreateOvertimeDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  @IsNotEmpty()
  date?: string; // Compatibilidad con payload actual

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime debe tener formato HH:mm en 24h',
  })
  startTime?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime debe tener formato HH:mm en 24h',
  })
  endTime?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OvertimeRequestInputDto)
  requests?: OvertimeRequestInputDto[];
}
