//por si despues se quiere filtrar por tipo


import { IsOptional, IsEnum } from 'class-validator';
import { LeaveType } from 'generated/prisma/enums';

export class ActiveLeavesQueryDto {
  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;
}