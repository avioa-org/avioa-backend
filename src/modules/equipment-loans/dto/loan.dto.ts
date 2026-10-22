import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  LOANED = 'LOANED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export class LoanDto {
  @IsString()
  @IsNotEmpty()
  equipmentId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsOptional()
  @IsDateString()
  expectedReturnDate?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus)
  status!: LoanStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}