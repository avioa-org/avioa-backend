// create-form.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FormType {
  NATIVE = 'NATIVE',
  GOOGLE_FORM = 'GOOGLE_FORM',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export class FormFieldDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  required?: boolean;

  @IsOptional()
  @IsArray()
  options?: Array<{ label: string; value: string }>;

  @IsOptional()
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export class FormSchemaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'El formulario debe tener al menos un campo' })
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];
}

export class CreateFormDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es requerido' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  @MaxLength(255, { message: 'El título no puede exceder 255 caracteres' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'La categoría es requerida' })
  @MinLength(2, { message: 'La categoría debe tener al menos 2 caracteres' })
  category!: string;

  @IsEnum(FormType, { message: 'El tipo de formulario no es válido' })
  type!: FormType;

  @ValidateIf((o) => o.type === FormType.GOOGLE_FORM)
  @IsString({ message: 'Para Google Form, embedUrl es requerido' })
  @IsNotEmpty({ message: 'Para Google Form, embedUrl es requerido' })
  embedUrl?: string;

  @ValidateIf((o) => o.type === FormType.NATIVE)
  @ValidateNested()
  @Type(() => FormSchemaDto)
  @IsNotEmpty({ message: 'Para formularios nativos, schema es requerido' })
  schema?: FormSchemaDto;

  @IsOptional()
  @IsObject()
  autofill?: Record<string, any>;
}

// update-form.dto.ts
export class UpdateFormDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  @MaxLength(255, { message: 'El título no puede exceder 255 caracteres' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'La descripción no puede exceder 1000 caracteres',
  })
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(FormStatus, { message: 'El estado no es válido' })
  status?: FormStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormSchemaDto)
  schema?: FormSchemaDto;

  @IsOptional()
  @IsObject()
  autofill?: Record<string, any>;
}

// submit-form.dto.ts
export class SubmitFormDto {
  @IsObject()
  @IsNotEmpty({ message: 'Los datos del formulario son requeridos' })
  data!: Record<string, any>;
}

// update-submission-status.dto.ts
export enum FormSubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVIEWED = 'REVIEWED',
}

export class UpdateSubmissionStatusDto {
  @IsEnum(FormSubmissionStatus, { message: 'El estado no es válido' })
  status!: FormSubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El comentario no puede exceder 500 caracteres' })
  comment?: string;
}
