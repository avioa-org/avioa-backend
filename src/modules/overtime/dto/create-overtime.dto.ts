import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateOvertimeDto {
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
