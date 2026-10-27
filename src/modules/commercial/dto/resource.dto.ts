import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { CommercialResourceKind } from "generated/prisma/enums";

export class CreateCommercialResourceDto {
  @IsEnum(CommercialResourceKind)
  kind!: CommercialResourceKind;

  @IsString()
  @MinLength(1)
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ValidateIf((_, value) => typeof value === "string" && value.length > 0)
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  origin?: string;
}

export class UpdateCommercialResourceDto extends CreateCommercialResourceDto {}