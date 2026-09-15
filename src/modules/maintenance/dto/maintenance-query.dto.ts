import { IsOptional, IsEnum, IsString } from 'class-validator';
import { MaintenanceStatus } from 'generated/prisma/enums';

export class MaintenanceQueryDto {
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;
}