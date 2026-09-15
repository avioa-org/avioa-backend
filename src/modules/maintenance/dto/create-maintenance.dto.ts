import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  equipmentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}