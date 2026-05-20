import { IsUUID, IsNotEmpty, IsString, Matches, IsEnum } from 'class-validator';
import { TipoDocumento } from '../enums/tipo-documento.enum';

export class GenerateCartaDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsUUID()
  @IsNotEmpty()
  templateId!: string;

  @IsString()
  @IsNotEmpty()
  nombrePasajero!: string;

  @IsString()
  @IsNotEmpty()
  numeroOrden!: string;

  @IsString()
  @IsNotEmpty()
  dia!: string;

  @IsString()
  @IsNotEmpty()
  mes!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'El año debe tener 4 dígitos' })
  anio!: string;
}
