import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAuxiliaryChatDto {
  @IsUUID()
  requestId!: string;

  @IsUUID()
  threadId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(6000)
  message!: string;
}
