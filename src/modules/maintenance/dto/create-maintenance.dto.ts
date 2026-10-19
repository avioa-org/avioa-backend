import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { MaintenanceRequestType } from 'generated/prisma/enums';

export class CreateMaintenanceDto {
  @IsEnum(MaintenanceRequestType)
  @IsNotEmpty()
  requestType!: MaintenanceRequestType;

  // Requerido si requestType = EQUIPMENT
  @IsOptional()
  @IsString()
  equipmentId?: string;

  // Requerido si requestType = GENERAL
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
