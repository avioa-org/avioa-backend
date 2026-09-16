import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { MaintenanceStatus } from 'generated/prisma/enums';

export class UpdateMaintenanceStatusDto {
  @IsEnum(MaintenanceStatus)
  status!: MaintenanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectedReason?: string;
}