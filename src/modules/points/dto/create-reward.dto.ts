import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';

import {
  HasMimeType,
  IsFile,
  IsFiles,
  MaxFileSize,
  MemoryStoredFile,
} from 'nestjs-form-data';

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

export class CreateBulkRewardDto {
  // @Transform(({ value }) => {
  //   try {
  //     return typeof value === 'string' ? JSON.parse(value) : value;
  //   } catch {
  //     return value;
  //   }
  // })
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => CreateRewardDto)
  @Allow()
  data!: any;

  @IsOptional()
  @IsFiles()
  @MaxFileSize(5 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/png', 'image/webp'], { each: true })
  files?: MemoryStoredFile | MemoryStoredFile[];
}
