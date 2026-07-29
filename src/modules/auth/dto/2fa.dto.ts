import { IsString } from 'class-validator';

export class Verify2faDto {
  @IsString()
  temporaryToken!: string;

  @IsString()
  code!: string;
}

export class Enable2faDto {
  @IsString()
  secret!: string;
}
