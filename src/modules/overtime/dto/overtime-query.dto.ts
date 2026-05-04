import { IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class OvertimeQueryDto {
  @IsNumberString()
  @IsOptional()
  year?: string;

  @IsNumberString()
  @IsOptional()
  month?: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string;
}
