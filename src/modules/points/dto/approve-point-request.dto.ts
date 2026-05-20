import { IsOptional, IsString } from 'class-validator';

export class ApprovePointRequestDto {
  @IsString()
  @IsOptional()
  decision?: string;
}
