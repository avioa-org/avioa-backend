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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    const { token, password } = acceptInviteDto;

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

    const payload = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatar: user.avatarUrl,
      role: user.role,
    };

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      access_token: this.jwt.sign(payload),
      ...payload,
    };
  }
}
