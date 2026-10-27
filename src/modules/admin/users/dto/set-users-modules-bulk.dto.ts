import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Modules } from 'src/common/enum/modules.enum';

export class SetUsersModulesBulkDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  userIds?: string[];

  @IsString()
  @IsOptional()
  area?: string;

  @IsArray()
  @IsEnum(Modules, { each: true })
  modules!: Modules[];

  @IsObject()
  @IsOptional()
  actions?: Record<string, string[]>;
}
