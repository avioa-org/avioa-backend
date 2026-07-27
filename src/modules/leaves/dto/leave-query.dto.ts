import { IsEnum, IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { LeaveStatus, LeaveType } from 'generated/prisma/enums';

export class LeaveQueryDto {
  @IsNumberString()
  @IsOptional()
  year?: string;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;

  @IsUUID()
  @IsOptional()
  employeeId?: string;
}
