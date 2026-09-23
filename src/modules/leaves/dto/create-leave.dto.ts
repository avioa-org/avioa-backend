import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LeaveType } from 'generated/prisma/enums';

export class CreateLeaveDto {
  @IsEnum(LeaveType, {
    message: 'Tipo de ausencia inválido',
  })
  type!: LeaveType;

  @IsDateString({}, { message: 'startDate debe ser una fecha válida' })
  @IsNotEmpty()
  startDate!: string; // YYYY-MM-DD

  @IsDateString({}, { message: 'endDate debe ser una fecha válida' })
  @IsNotEmpty()
  endDate!: string; // YYYY-MM-DD (inclusive)

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
