import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class HistoricalVacationEntryDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  leaderId!: string;

  @IsInt()
  @Min(0)
  businessDays!: number;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsInt()
  newAdjustment!: number;
}

export class BulkMigrateVacationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HistoricalVacationEntryDto)
  entries!: HistoricalVacationEntryDto[];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
