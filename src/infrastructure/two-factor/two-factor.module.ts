import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from './two-factor.service';

@Global()
@Module({
  providers: [PrismaService, TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
