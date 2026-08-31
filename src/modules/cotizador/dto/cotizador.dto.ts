import { IsBoolean, IsInt, IsNumber, IsString } from 'class-validator';

export class CotizadorDto {
  @IsString()
  texto_usuario!: string;

  @IsString()
  plan_hoteles!: string;

  @IsNumber()
  @IsInt()
  max_hoteles!: number;

  @IsBoolean()
  solo_fecha_exacta!: boolean;
}
