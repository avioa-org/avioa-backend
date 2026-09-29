import { IsArray, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { Modules } from 'src/common/enum/modules.enum';

export class SetUserModulesDto {
  @IsArray()
  @IsEnum(Modules, { each: true })
  modules!: Modules[];

  @IsObject()
  @IsOptional()
  actions?: Record<string, string[]>;

  @IsUUID()
  @IsOptional()
  grantedBy?: string;
}
