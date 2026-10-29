import { IsUUID } from 'class-validator';

export class ExtractAuxiliaryDocumentDto {
  @IsUUID()
  requestId!: string;
}
