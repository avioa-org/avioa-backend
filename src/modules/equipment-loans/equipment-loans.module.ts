import { Module } from '@nestjs/common';
import { EquipmentLoansService } from './equipment-loans.service';
import { EquipmentLoansController } from './equipment-loans.controller';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Module({
  controllers: [EquipmentLoansController],
  providers: [EquipmentLoansService, PrismaService],
})
export class EquipmentLoansModule {}
