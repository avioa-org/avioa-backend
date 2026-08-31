import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { FeedPostType } from 'generated/prisma/enums';

export class FeedQueryDto {
  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsEnum(FeedPostType)
  type?: FeedPostType;

  @IsString()
  @IsOptional()
  cursor?: string;
}
