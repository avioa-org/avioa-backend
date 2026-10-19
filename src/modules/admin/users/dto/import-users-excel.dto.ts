import { IsOptional, IsEnum } from 'class-validator';
import { LegalEntity } from '../enum/legal-entity.enum';

export class ImportUsersExcelDto {
  // Opcional: forzar la razón social para todas las filas, ignorando la columna
  @IsOptional()
  @IsEnum(LegalEntity)
  legalEntity?: LegalEntity;
}
