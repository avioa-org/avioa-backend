import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export enum VaultScope {
  OWN = 'own',
  SHARED = 'shared',
}

export class SearchPasswordVaultDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsInt()
  @IsOptional()
  skip?: number;

  @IsInt()
  @IsOptional()
  take?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsEnum(VaultScope)
  scope?: VaultScope;
}
