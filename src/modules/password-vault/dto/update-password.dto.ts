import { CreatePasswordDto } from './create-password.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdatePasswordDto extends PartialType(CreatePasswordDto) {}
