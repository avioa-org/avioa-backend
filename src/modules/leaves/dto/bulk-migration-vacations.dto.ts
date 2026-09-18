import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { LeaveStatus } from 'generated/prisma/enums';

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

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
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
