import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OTP } from 'otplib';
import { compare } from 'bcrypt';

@Injectable()
export class TwoFactorService {
  private readonly otp = new OTP();

  constructor(private readonly prisma: PrismaService) {}

  async verify(userId: string, token: string): Promise<void> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException(
        'Debes activar la verificación en dos pasos para revelar contraseñas',
      );
    }

    const isValid = await this.otp.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid.valid) {
      throw new UnauthorizedException('Código de verificación inválido');
    }
  }

  async verifyOrFallback(
    userId: string,
    dto: { totpCode?: string; loginPassword?: string; onlyCopy?: boolean },
  ) {
    if (dto.onlyCopy) {
      return;
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true, password: true },
    });

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!dto.totpCode) {
        throw new UnauthorizedException(
          'Se requiere código de verificación en dos pasos',
        );
      }

      const isValid = await this.otp.verify({
        token: dto.totpCode,
        secret: user.twoFactorSecret,
      });
      if (!isValid.valid) {
        throw new UnauthorizedException('Código de verificación inválido');
      }
      return;
    }

    if (!dto.loginPassword || !user.password) {
      throw new UnauthorizedException('Se requiere confirmar tu contraseña');
    }

    const matches = await compare(dto.loginPassword, user.password);
    if (!matches) throw new UnauthorizedException('Contraseña incorrecta');
  }
}
