import { IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RequestPointsDto {
  @IsInt()
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsUUID()
  @IsNotEmpty()
  leaderId!: string;
}
