import { IsBoolean, IsUUID } from 'class-validator';

export class ConfirmAssistantActionDto {
  @IsUUID()
  actionId!: string;

  @IsBoolean()
  confirmed!: boolean;
}
