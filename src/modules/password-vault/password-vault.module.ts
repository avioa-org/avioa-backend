import { Module } from '@nestjs/common';
import { PasswordVaultService } from './password-vault.service';
import { PasswordVaultController } from './password-vault.controller';
import { TwoFactorService } from 'src/infrastructure/two-factor/two-factor.service';
import { VaultDashboardService } from './vault-dasboard.service';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config/env.config';
import { PasswordVaultGateway } from './password-vault.gateway';

@Module({
  controllers: [PasswordVaultController],
  providers: [
    PasswordVaultService,
    TwoFactorService,
    VaultDashboardService,
    EncryptionService,
    PasswordVaultGateway,
    PrismaService,
  ],
  exports: [PasswordVaultService, PasswordVaultGateway],
  imports: [
    JwtModule.register({
      secret: envs.JWT_SECRET,
    }),
  ],
})
export class PasswordVaultModule {}
