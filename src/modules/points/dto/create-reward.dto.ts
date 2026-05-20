import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';

export class CreateRewardDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  cost!: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class CreateBulkRewardDto {
  @IsArray()
  @ValidateNested({ each: true })
  data!: CreateRewardDto[];
}
