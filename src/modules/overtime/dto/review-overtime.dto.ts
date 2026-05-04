import {
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OvertimeStatus } from '../../generated/prisma';

export class ReviewOvertimeDto {
  @IsEnum([OvertimeStatus.APPROVED, OvertimeStatus.REJECTED], {
    message: 'El estado debe ser APPROVED o REJECTED',
  })
  status: OvertimeStatus.APPROVED | OvertimeStatus.REJECTED;

  @ValidateIf((o) => o.status === OvertimeStatus.REJECTED)
  @IsNotEmpty({ message: 'El comentario es obligatorio al rechazar' })
  @IsString()
  @MaxLength(300)
  comment?: string;
}
