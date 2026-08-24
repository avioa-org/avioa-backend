import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  documentNumber?: string;
}
