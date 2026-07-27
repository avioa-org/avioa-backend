import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LeaveStatus } from 'generated/prisma/enums';

export class ReviewLeaveDto {
  @IsEnum(['APPROVED', 'REJECTED'], {
    message: 'El estado debe ser APPROVED o REJECTED',
  })
  status!: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>;

  @ValidateIf((o) => o.status === 'REJECTED')
  @IsNotEmpty({ message: 'El comentario es obligatorio al rechazar' })
  @IsString()
  @MaxLength(300)
  comment?: string;
}
