import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FeedPostType } from 'generated/prisma/enums';

export class CreatePostDto {
  @IsEnum(FeedPostType)
  type!: FeedPostType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsUUID()
  recognizedUserId?: string;
}
