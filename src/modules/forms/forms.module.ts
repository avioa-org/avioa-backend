import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [FormsController],
  providers: [FormsService, PrismaService],
})
export class FormsModule {}
