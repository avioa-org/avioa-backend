import { IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug!: string;

  @IsArray()
  @IsString({ each: true })
  headers!: string[];
}

export class SaveRowDto {
  @IsArray()
  @IsString({ each: true })
  cells!: string[];
}