import { Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CesantiasMotivo } from 'generated/prisma/enums';

export class DetalleEducacionDto {
  @IsString()
  @IsNotEmpty()
  beneficiario!: string; // "colaborador" | "hijo" | "conyuge" | "companero"

  @IsString()
  @IsNotEmpty()
  nombreBeneficiario!: string;

  @IsString()
  @IsNotEmpty()
  institucionEducativa!: string;

  @IsString()
  @IsNotEmpty()
  programaAcademico!: string;

  @IsString()
  @IsNotEmpty()
  periodoAcademico!: string;
}

export class DetalleViviendaDto {
  @IsString()
  @IsNotEmpty()
  tipoInmueble!: string; // "casa" | "apartamento" | "lote" | "otro"

  @IsString()
  @IsNotEmpty()
  direccionInmueble!: string;

  @IsString()
  @IsNotEmpty()
  matriculaInmobiliaria!: string;

  @IsString()
  @IsNotEmpty()
  titularInmueble!: string; // "colaborador" | "conyuge" | "ambos"

  @IsString()
  @IsNotEmpty()
  entidadFinanciera!: string;
}

export class DetallePredialDto {
  @IsString()
  @IsNotEmpty()
  direccionInmueble!: string;

  @IsString()
  @IsNotEmpty()
  numeroPredial!: string;

  @IsString()
  @IsNotEmpty()
  vigenciaImpuesto!: string; // año/periodo del predial
}

export class DetalleTerminacionDto {
  @IsString()
  @IsNotEmpty()
  tipoTerminacion!: string; // "renuncia" | "mutuo_acuerdo" | etc.

  @IsString()
  @IsNotEmpty()
  fechaTerminacion!: string; // ISO date string
}

export class CreateCesantiasDto {
  // Datos del colaborador
  @IsString()
  @IsNotEmpty()
  nombreCompleto!: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento!: string; // ver CATALOGO_TIPO_DOCUMENTO

  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @IsEmail()
  correo!: string;

  @IsString()
  @IsNotEmpty()
  telefono!: string;

  @IsString()
  @IsNotEmpty()
  cargo!: string;

  @IsString()
  @IsNotEmpty()
  area!: string;

  @IsString()
  @IsNotEmpty()
  razonSocial!: string; // ver CATALOGO_RAZON_SOCIAL

  @IsString()
  @IsNotEmpty()
  fondo!: string; // ver CATALOGO_FONDO

  @ValidateIf((o) => o.fondo === 'otro')
  @IsString()
  @IsNotEmpty({ message: 'Debes indicar el nombre del fondo.' })
  fondoOtro?: string;

  @IsNumber()
  @Min(1, { message: 'El valor solicitado debe ser mayor a cero.' })
  valorSolicitado!: number;

  @IsOptional()
  @IsNumber()
  saldoDisponible?: number;

  // Motivo
  @IsEnum(CesantiasMotivo, { message: 'Selecciona un motivo válido.' })
  motivo!: CesantiasMotivo;

  // Detalle condicional según motivo — se valida uno solo, el que corresponda
  @ValidateIf((o) => o.motivo === CesantiasMotivo.EDUCACION)
  @ValidateNested()
  @Type(() => DetalleEducacionDto)
  detalleEducacion?: DetalleEducacionDto;

  @ValidateIf(
    (o) =>
      o.motivo === CesantiasMotivo.COMPRA_VIVIENDA ||
      o.motivo === CesantiasMotivo.MEJORA_VIVIENDA,
  )
  @ValidateNested()
  @Type(() => DetalleViviendaDto)
  detalleVivienda?: DetalleViviendaDto;

  @ValidateIf((o) => o.motivo === CesantiasMotivo.IMPUESTO_PREDIAL)
  @ValidateNested()
  @Type(() => DetallePredialDto)
  detallePredial?: DetallePredialDto;

  @ValidateIf((o) => o.motivo === CesantiasMotivo.TERMINACION_CONTRATO)
  @ValidateNested()
  @Type(() => DetalleTerminacionDto)
  detalleTerminacion?: DetalleTerminacionDto;

  // Declaraciones — todas deben ser exactamente `true`
  @Equals(true, { message: 'Debes aceptar la declaración de veracidad.' })
  declaraVeracidad!: boolean;

  @Equals(true, {
    message: 'Debes aceptar la declaración de destinación de los recursos.',
  })
  declaraDestinacion!: boolean;

  @Equals(true, {
    message: 'Debes aceptar el tratamiento de datos personales.',
  })
  declaraTratamientoDatos!: boolean;

  @Equals(true, {
    message: 'Debes confirmar que enviarás los documentos soporte adicionales.',
  })
  declaraDocsAdicionales!: boolean;
}
