import { IsOptional, IsUUID } from 'class-validator';

export class AuxiliaryChatQueryDto {
  @IsOptional()
  @IsUUID()
  threadId?: string;
}
