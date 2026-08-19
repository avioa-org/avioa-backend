import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class GeneratePasswordDto {
  @IsInt()
  @Min(8)
  @Max(64)
  length!: number;

  @IsBoolean() uppercase!: boolean;
  @IsBoolean() lowercase!: boolean;
  @IsBoolean() numbers!: boolean;
  @IsBoolean() symbols!: boolean;
  @IsBoolean() excludeSimilar!: boolean;
}
