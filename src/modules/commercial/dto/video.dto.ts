import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class VideoEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsString()
  @MaxLength(2000)
  @ValidateIf((_, v) => typeof v === "string" && v.length > 0)
  @IsUrl({ protocols: ["https", "http"], require_protocol: true })
  url!: string;
}

export class VideoActionDto {
  @IsIn(["add", "edit", "delete", "import"])
  action!: "add" | "edit" | "delete" | "import";

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => VideoEntryDto)
  entry?: VideoEntryDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoEntryDto)
  entries?: VideoEntryDto[];
}