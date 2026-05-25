import { IsEmail, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  confirmPassword!: string;
}

export class ForgotPasswordSendDto {
  @IsEmail()
  email!: string;
}
