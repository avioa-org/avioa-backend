import { IsInt } from 'class-validator';

export class UpdateVacationAdjustmentDto {
  @IsInt({ message: 'El ajuste de vacaciones debe ser un número entero' })
  vacationDaysAdjustment!: number;
}
