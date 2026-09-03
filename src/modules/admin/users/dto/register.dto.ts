import {
  IsBoolean,
  IsDate,
  IsDecimal,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ContractType, DocumentType, Role } from 'generated/prisma/enums';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(Object.values(Role))
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isLeader?: boolean;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsDate()
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @IsOptional()
  birthDate?: Date;

  @IsEnum([
    DocumentType.CC,
    DocumentType.CE,
    DocumentType.PA,
    DocumentType.PEP,
    DocumentType.TI,
  ])
  @IsOptional()
  documentType?: DocumentType;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  office?: string;

  @IsEnum([
    ContractType.APRENDIZAJE,
    ContractType.FIJO,
    ContractType.INDEFINIDO,
    ContractType.OBRA_LABOR,
    ContractType.PRESTACION,
  ])
  @IsOptional()
  contractType?: ContractType;

  @IsString()
  @IsOptional()
  eps?: string;

  @IsString()
  @IsOptional()
  afp?: string;

  @IsString()
  @IsOptional()
  arl?: string;

  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  emergencyContactRel?: string;

  @IsUUID()
  @IsOptional()
  leaderId?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}
