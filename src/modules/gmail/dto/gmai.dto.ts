import { IsString } from 'class-validator';

export class ProcesarPagoTotalDto {
  @IsString()
  threadId: string;

  @IsString()
  subject: string;

  @IsString()
  from: string;

  @IsString()
  date: string;

  @IsString()
  body: string;
}
