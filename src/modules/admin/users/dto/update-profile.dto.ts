import {
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  HasMimeType,
  IsFiles,
  MaxFileSize,
  MemoryStoredFile,
} from 'nestjs-form-data';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  @IsString()
  @IsOptional()
  email?: string;

  @IsDate()
  @IsOptional()
  birthDate?: Date;

  @IsString()
  @IsOptional()
  area?: string;

  @ValidateIf((_, value) => {
    console.log(value);
    return value !== 'undefined';
  })
  @IsOptional()
  @IsFiles()
  @MaxFileSize(5 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/png', 'image/webp'], { each: true })
  file?: MemoryStoredFile | MemoryStoredFile[];
}
