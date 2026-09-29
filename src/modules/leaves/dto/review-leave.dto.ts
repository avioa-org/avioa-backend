import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveStatus } from 'generated/prisma/enums';

export class ReviewLeaveDto {
  @IsIn([LeaveStatus.APPROVED, LeaveStatus.REJECTED], {
    message: 'status debe ser APPROVED o REJECTED',
  })
  status!: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
