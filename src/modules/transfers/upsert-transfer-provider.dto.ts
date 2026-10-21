import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertTransferProviderDto {
  @IsIn(['CARTAGENA', 'SANTA_MARTA', 'SAN_ANDRES', 'PALOMINO', 'BARU'])
  destination!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['EMAIL', 'WHATSAPP'])
  channel!: string;

  @IsString()
  @MaxLength(350)
  contact!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
