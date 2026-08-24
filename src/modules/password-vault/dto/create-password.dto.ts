import {
  IsArray,
  IsDate,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreatePasswordDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsDate()
  @IsOptional()
  expiresAt?: Date;

  @IsNumber()
  @IsOptional()
  rotationDays?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tagIds?: string[];
}
