import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { compare } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { CreateUserDto } from '../admin/users/dto/register.dto';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { envs } from 'src/config/env.config';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { hash } from 'bcrypt';
import {
  ForgotPasswordDto,
  ForgotPasswordSendDto,
} from './dto/forgot-password';
import { sign, verify } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { OTP } from 'otplib';
import { Enable2faDto, Verify2faDto } from './dto/2fa.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otp = new OTP();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: EmailService,
  ) {}

  public async inviteUser(registerDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      this.logger.error(`User with email ${registerDto.email} alreadt exists`);
      throw new BadRequestException({
        message: `El usuario con el correo ${registerDto.email} ya existe`,
        error: 'USER_ALREADY_EXISTS',
      });
    }

    if (registerDto.role === 'EMPLOYEE' && registerDto.leaderId) {
      const leader = await this.prisma.user.findUnique({
        where: { userId: registerDto.leaderId, role: 'LEADER' },
      });
      if (!leader)
        throw new BadRequestException({
          message: `El lider asignado no existe o no tiene el rol correcto`,
          error: 'INVALID_LEADER',
        });
    }

    if (registerDto.role === 'LEADER' && registerDto.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { userId: registerDto.managerId, role: 'MANAGER' },
      });
      if (!manager)
        throw new BadRequestException({
          message: 'El manager asignado no existe o no tiene el rol correcto',
          error: 'INVALID_MANAGER',
        });
    }

    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    const newUser = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        status: 'PENDING',
        password: null,
        department: registerDto.department,
        area: registerDto.area,
        position: registerDto.position,
        leaderId: registerDto.leaderId,
        managerId: registerDto.managerId,
        inviteToken,
        inviteExpires,
      },
    });

    // Aca se envia el correo
    await this.mailService.sendInvite({
      to: newUser.email,
      subject: 'Invitación a Avioa',
      inviteUrl: `${envs.FRONTEND_URL}/auth/invite?token=${inviteToken}`,
    });

    this.logger.log(`Invite sent to ${newUser.email}`);

    return {
      message: `Invitación enviada a ${newUser.email}`,
      userId: newUser.userId,
    };
  }

  public async acceptInvite(acceptInviteDto: AcceptInviteDto) {
    const { token, password, confirmPassword } = acceptInviteDto;

    if (password !== confirmPassword) {
      throw new BadRequestException({
        message: 'Las contraseñas no coinciden',
        error: 'PASSWORDS_DO_NOT_MATCH',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { inviteToken: token },
    });

    if (!user || !user.inviteExpires) {
      throw new BadRequestException({
        message: 'El link de invitación no es válido',
        error: 'INVALID_INVITE_TOKEN',
      });
    }

    if (user.inviteExpires < new Date()) {
      throw new BadRequestException({
        message:
          'El link de invitación ha expirado, contacta con el administrador',
        error: 'EXPIRED_INVITE_TOKEN',
      });
    }

    if (user.status !== 'PENDING') {
      throw new BadRequestException({
        message: 'El link de invitación ya fue utilizado',
        error: 'USED_INVITE_TOKEN',
      });
    }

    const passwordHash = await hash(password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: passwordHash,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpires: null,
      },
    });

    this.logger.log(
      `User ${updatedUser.email} accepted the invite and is now active`,
    );

    return {
      message: 'Contraseña creada exitosamente, ya puedes iniciar sesión',
    };
  }

  public async validateInviteToken(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: token },
    });

    if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
      throw new BadRequestException({
        message: 'El link de invitación no es válido o ha expirado',
        error: 'INVALID_OR_EXPIRED_INVITE_TOKEN',
      });
    }

    if (user.status !== 'PENDING') {
      throw new BadRequestException({
        message: 'El link de invitación ya fue utilizado',
        error: 'INVITE_ALREADY_USED',
      });
    }

    return {
      name: user.name,
      email: user.email,
    };
  }

  public async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email, status: 'ACTIVE' },
      include: { leader: { select: { name: true, userId: true } } },
    });

    if (!user) {
      this.logger.error(`User with email ${email} not found`);
      throw new NotFoundException({
        message: `El usuario con el correo: ${email} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const isPasswordValid = await compare(
      password,
      user.password as unknown as string,
    );

    if (!isPasswordValid) {
      this.logger.error(`Password is not valid`);
      throw new UnauthorizedException({
        message: 'Contraseña incorrecta',
        error: 'INVALID_PASSWORD',
      });
    }

    if (user.twoFactorEnabled) {
      this.logger.log(`2FA enabled for user ${user.email}`);
      const temporaryToken = this.generateTemporaryToken(user.userId);
      await this.prisma.user.update({
        where: { userId: user.userId },
        data: {
          temporyToken: temporaryToken,
        },
      });
      return { temporaryToken, twoFactorEnabled: true };
    }

    this.logger.log(`User ${user.email} logged in successfully`);

    const tokens = await this.issueTokens({
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      area: user.area,
      leaderId: user.leaderId,
      leaderName: user.leader?.name,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    return tokens;
  }

  public async forgotPassword(forgotPassword: ForgotPasswordDto) {
    const { email, password, confirmPassword } = forgotPassword;

    if (password !== confirmPassword) {
      throw new BadRequestException({
        message: 'Las contraseñas no coinciden',
        error: 'PASSWORDS_DO_NOT_MATCH',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email, status: 'ACTIVE' },
    });

    if (!user) {
      throw new NotFoundException({
        message: `El usuario con el correo: ${email} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const passwordHash = await hash(password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: passwordHash,
      },
    });

    this.logger.log(`User ${user.email} updated password successfully`);

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }

  public async forgotPasswordSend(
    forgotPasswordSendDto: ForgotPasswordSendDto,
  ) {
    const { email } = forgotPasswordSendDto;

    const user = await this.prisma.user.findUnique({
      where: { email, status: 'ACTIVE' },
    });

    if (!user) {
      throw new NotFoundException({
        message: `El usuario con el correo: ${email} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const linkToSend = `${envs.FRONTEND_URL}/forgot-password?email=${user.email}`;

    await this.mailService.sendInvite({
      to: user.email,
      subject: 'Recuperación de contraseña',
      inviteUrl: linkToSend,
    });

    return { message: 'Link enviado exitosamente' };
  }

  private async issueTokens(user: {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    area: string | null;
    leaderId: string | null;
    leaderName: string | null | undefined;
    twoFactorEnabled?: boolean;
  }) {
    const payload = {
      userId: user.userId,
      name: user.name,
      avatar: user.avatarUrl,
      role: user.role,
      area: user.area,
      leaderId: user.leaderId,
      leaderName: user.leaderName,
      twoFactorEnabled: user.twoFactorEnabled,
    };

    const access_token = this.jwt.sign(payload);

    const refresh_token = sign(
      { userId: user.userId },
      envs.JWT_REFRESH_SECRET,
      {
        expiresIn: (envs.JWT_REFRESH_EXPIRES_IN as StringValue) ?? '7d',
      },
    );

    const hashedRefresh = await hash(refresh_token, 10);

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        refreshToken: hashedRefresh,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: payload,
    };
  }

  public async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    let decoded: { userId?: string };

    try {
      decoded = verify(refreshToken, envs.JWT_REFRESH_SECRET) as {
        userId?: string;
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!decoded?.userId) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId: decoded.userId, status: 'ACTIVE' },
      include: { leader: { select: { name: true } } },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid sesion');
    }

    const matches = await compare(refreshToken, user.refreshToken);

    if (!matches) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokens({
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      area: user.area,
      leaderId: user.leaderId,
      leaderName: user.leader?.name,
    });
  }

  public async logout(userId: string) {
    await this.prisma.user.update({
      where: { userId },
      data: { refreshToken: null },
    });

    return { message: 'logout successfully' };
  }

  public async generate2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (user?.twoFactorEnabled) {
      this.logger.error(`2FA already enabled for user ${userId}`);
      throw new BadRequestException('2FA already enabled');
    }

    const secret = this.otp.generateSecret();

    // await this.prisma.user.update({
    //   where: { userId },
    //   data: {
    //     twoFactorSecret: secret,
    //     twoFactorEnabled: true,
    //   },
    // });

    this.logger.log(`2FA enabled for user ${userId}`);

    const qr = this.otp.generateURI({
      issuer: `Portal Avioa`,
      label: user?.email as string,
      secret: secret,
    });

    return { otpauthUrl: qr, secret, enabled: false };
  }

  public async save2FA(userId: string, data: Enable2faDto) {
    const { secret } = data;

    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User ${userId} not found`);
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.prisma.user.update({
      where: { userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
      },
    });

    return { message: '2FA guardado exitosamente', enabled: true };
  }

  public async verify2FA(data: Verify2faDto) {
    const { temporaryToken, code } = data;

    if (!temporaryToken || !code) {
      this.logger.error(`Missing temporary token or code`);
      throw new BadRequestException('Missing temporary token or code');
    }

    const verifyToken = verify(temporaryToken, envs.JWT_SECRET);

    if (!verifyToken) {
      this.logger.error(`Invalid temporary token`);
      throw new UnauthorizedException('Invalid temporary token');
    }

    const { userId } = verifyToken as { userId?: string };

    if (!userId) {
      this.logger.error(`User id not found in temporary token payload`);
      throw new UnauthorizedException(
        'User id not found in temporary token payload',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { userId, status: 'ACTIVE' },
      include: { leader: { select: { name: true, userId: true } } },
    });

    if (!user?.twoFactorEnabled) {
      this.logger.error(`2FA not enabled for user ${userId}`);
      throw new BadRequestException('2FA not enabled');
    }

    if (!user.twoFactorSecret) {
      this.logger.error(`2FA secret not found for user ${userId}`);
      throw new BadRequestException('2FA secret not found');
    }

    if (user.temporyToken !== temporaryToken) {
      this.logger.error(`Invalid temporary token for user ${userId}`);
      throw new BadRequestException('Invalid temporary token');
    }

    const verifyCode = await this.otp.verify({
      secret: user.twoFactorSecret,
      token: code,
    });

    if (!verifyCode.valid) {
      this.logger.error(`Invalid 2FA code for user ${userId}`);
      throw new BadRequestException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { userId },
      data: {
        twoFactorEnabled: true,
        temporyToken: null,
      },
    });

    const tokens = await this.issueTokens({
      userId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      area: user.area,
      leaderId: user.leaderId,
      leaderName: user.leader?.name,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    return tokens;
  }

  public async disabled2FA(userId: string) {
    await this.prisma.user.update({
      where: { userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
  }

  private generateTemporaryToken(userId: string) {
    const token = sign({ userId }, envs.JWT_SECRET, {
      expiresIn: '5m',
    });

    return token;
  }
}
