import { IsNotEmpty, IsString } from 'class-validator';

export class MarkNotTakenDto {
  @IsString()
  @IsNotEmpty({ message: 'Debes indicar el motivo.' })
  reason!: string;
}
