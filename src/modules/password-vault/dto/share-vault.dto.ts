import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ShareVaultDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsBoolean()
  canView: boolean = true;

  @IsBoolean()
  canEdit: boolean = false;

  @IsBoolean()
  canAdmin: boolean = false;
}

export class UpdatePermissionDto {
  @IsBoolean()
  @IsOptional()
  canView?: boolean;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean;

  @IsBoolean()
  @IsOptional()
  canAdmin?: boolean;
}
