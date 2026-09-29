import { differenceInCalendarDays } from 'date-fns';
import {
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { FiltrosNominaDto } from './filtros-nomina.dto';

const MAX_DIAS_EXPORT = 93;

@ValidatorConstraint({ name: 'RangoExportable', async: false })
class RangoExportableConstraint implements ValidatorConstraintInterface {
  validate(_: any, args?: ValidationArguments) {
    const obj = args?.object as ExportarNominaDto;
    if (!obj.desde || !obj.hasta) return true;
    const dias = differenceInCalendarDays(
      new Date(obj.hasta),
      new Date(obj.desde),
    );
    return dias >= 0 && dias <= MAX_DIAS_EXPORT;
  }
  defaultMessage() {
    return `El rango de exportación no puede superar ${MAX_DIAS_EXPORT} días. Divide la exportación en periodos más cortos.`;
  }
}

export class ExportarNominaDto extends FiltrosNominaDto {
  @Validate(RangoExportableConstraint)
  private readonly _rangoCheck?: unknown;
}
