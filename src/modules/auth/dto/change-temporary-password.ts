import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangeTemporaryPasswordDto {
  @IsString()
  temporaryToken!: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(100, {
    message: 'La contraseña no puede superar los 100 caracteres',
  })
  @Matches(/[A-Z]/, {
    message: 'La contraseña debe contener al menos una letra mayúscula',
  })
  @Matches(/[a-z]/, {
    message: 'La contraseña debe contener al menos una letra minúscula',
  })
  @Matches(/[0-9]/, {
    message: 'La contraseña debe contener al menos un número',
  })
  newPassword!: string;
}
