import { IsObject } from 'class-validator';

export class CreateTransferRequestDto {
  @IsObject()
  payload!: Record<string, unknown>;
}
