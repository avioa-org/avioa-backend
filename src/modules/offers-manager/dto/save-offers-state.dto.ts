import { IsInt, IsObject, Min } from 'class-validator';
import { type OffersPayload } from '../types/offers-manager.native.types';

export class SaveOffersStateDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsObject()
  payload!: OffersPayload;
}
