import { IsOptional, IsString, IsDateString, IsNotEmpty } from 'class-validator';

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

  @IsDateString()
  @IsNotEmpty()
  expectedReturnDate!: string;
}