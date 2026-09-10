import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  documentNumber!: string;

  @IsString()
  password!: string;

  @IsString()
  confirmPassword!: string;
}

export class ForgotPasswordSendDto {
  @IsEmail()
  email!: string;

  @IsString()
  documentNumber!: string;
}
