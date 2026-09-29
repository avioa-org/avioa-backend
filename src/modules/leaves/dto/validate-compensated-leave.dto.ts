import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ValidateCompensatedLeaveDto {
  @IsIn(['APPROVE', 'REJECT'], {
    message: 'action debe ser APPROVE o REJECT',
  })
  action!: 'APPROVE' | 'REJECT';

  @ValidateIf((o) => o.action === 'REJECT')
  @IsString()
  @IsNotEmpty({ message: 'Debes indicar el motivo del rechazo' })
  @MaxLength(500)
  comment?: string;
}
