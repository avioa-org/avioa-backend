import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { UserStatus } from 'generated/prisma/enums';

export class UpdateUserDto {
  @IsEnum(Object.values(UserStatus))
  @IsOptional()
  status?: UserStatus;

  @IsBoolean()
  @IsOptional()
  isLeader?: boolean;

  @IsInt()
  @IsOptional()
  vacationDaysAdjustment?: number;
}
