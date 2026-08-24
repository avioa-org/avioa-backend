import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RevealPasswordDto {
  @IsOptional()
  @IsString()
  totpCode?: string;

  @IsOptional()
  @IsString()
  loginPassword?: string;

  @IsOptional()
  @IsBoolean()
  onlyCopy?: boolean;
}
