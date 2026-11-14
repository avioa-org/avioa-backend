import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiQuoteRequestDto {
  @IsOptional()
  @IsString()
  requestId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message;

  @IsOptional()
  @IsArray()
  history?: Array<{ question: string; answer: string }>;

  @IsOptional()
  @IsString()
  threadId?: string;

}