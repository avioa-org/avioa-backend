import { IsString, IsOptional, IsUUID, IsEnum, IsNotEmpty } from 'class-validator';

export enum EquipmentCategory {
  LAPTOP = 'LAPTOP',
  CELLPHONE = 'CELLPHONE',
  KEYBOARD = 'KEYBOARD',
  MOUSE = 'MOUSE',
  HEADPHONES = 'HEADPHONES',
  MONITOR = 'MONITOR',
  PRINTER = 'PRINTER',
  PROJECTOR = 'PROJECTOR',
  OTHER = 'OTHER',
}

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  LOANED = 'LOANED',
  MAINTENANCE = 'MAINTENANCE',
  DAMAGED = 'DAMAGED',
}

export class EquipmentDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsNotEmpty()
  @IsEnum(EquipmentCategory)
  category!: EquipmentCategory;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}