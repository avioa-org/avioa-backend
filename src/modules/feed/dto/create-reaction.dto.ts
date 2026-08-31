import { IsEnum } from 'class-validator';
import { ReactionType } from 'generated/prisma/enums';

export class CreateReactionDto {
  @IsEnum(ReactionType)
  type!: ReactionType;
}
