import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AuxiliaryChatQueryDto {
  @IsOptional()
  @IsUUID()
  threadId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
