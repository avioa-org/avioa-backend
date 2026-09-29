import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LeaveType } from 'generated/prisma/enums';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateLeaveDto {
  @IsEnum(LeaveType, {
    message: 'Tipo de ausencia inválido',
  })
  type!: LeaveType;

  @ValidateIf((o) => !(o.esCompensada && o.type === LeaveType.VACACIONES))
  @IsDateString({}, { message: 'startDate debe ser una fecha válida' })
  @IsNotEmpty()
  startDate?: string; // YYYY-MM-DD

  @ValidateIf((o) => !(o.esCompensada && o.type === LeaveType.VACACIONES))
  @IsDateString({}, { message: 'endDate debe ser una fecha válida' })
  @IsNotEmpty()
  endDate?: string; // YYYY-MM-DD (inclusive)

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:mm' })
  endTime?: string;

  @ValidateIf((o) => o.esCompensada === true && o.type === LeaveType.VACACIONES)
  @IsInt({ message: 'compensatedDays debe ser un entero' })
  @Min(1, { message: 'Debes compensar al menos 1 día' })
  @Type(() => Number)
  compensatedDays?: number;

  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsUrl({}, { message: 'attachmentUrl debe ser una URL válida' })
  attachmentUrl?: string;

  // Este campo es para permitir que un ADMIN/RRHH registre permisos en nombre de alguien
  @IsOptional()
  @IsString()
  leaderId?: string;

  @IsOptional()
  @IsBoolean()
  esCompensada?: boolean;

  // @ValidateIf((o) => o.esCompensada === true && o.type === LeaveType.VACACIONES)
  // @IsString()
  // @IsNotEmpty({
  //   message:
  //     'El radicado del proceso externo es obligatorio para vacaciones compensadas',
  // })
  // @MaxLength(120)
  // externalApprovalRef?: string;

  // @IsOptional()
  // @IsDateString()
  // externalApprovedAt?: string;
}
