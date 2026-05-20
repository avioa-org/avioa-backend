import { IsString } from 'class-validator';

export class RejectPointRequestDto {
  @IsString()
  reason!: string;
}
