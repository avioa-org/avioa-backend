import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FeedPostType } from 'generated/prisma/enums';
import { AttachmentInputDto } from './attachment.dto';

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}
