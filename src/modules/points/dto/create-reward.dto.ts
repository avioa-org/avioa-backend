import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  cost!: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
