import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
// import { RegisterDto } from './dto/register.dto';
import { hash } from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { randomBytes } from 'node:crypto';
import { envs } from 'src/config/env.config';
import { CreateUserDto } from './dto/register.dto';
import { EmailService } from 'src/infrastructure/email/email.infra';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
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
      inviteUrl: `${envs.FRONTEND_URL}/invite?token=${inviteToken}`,
    });

    this.logger.log(`Invite sent to ${newUser.email}`);

    return {
      message: `Invitación enviada a ${newUser.email}`,
      userId: newUser.userId,
    };
  }

  // public async register(registerDto: RegisterDto) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { email: registerDto.email, status: 'ACTIVE' },
  //   });

  //   if (user) {
  //     this.logger.error(`User with email ${registerDto.email} already exists`);
  //     throw new BadRequestException({
  //       message: `El usuario con el correo: ${registerDto.email} ya existe`,
  //       error: 'USER_ALREADY_EXISTS',
  //     });
  //   }

  //   const passwordHash = await hash(registerDto.password, 10);

  //   const newUser = await this.prisma.user.create({
  //     data: {
  //       email: registerDto.email,
  //       password: passwordHash,
  //       name: registerDto.name,
  //       role: registerDto.role,
  //       avatarUrl: registerDto.avatarUrl,
  //       phone: registerDto.phone,
  //       department: registerDto.department,
  //       position: registerDto.position,
  //     },
  //   });

  //   const payload = {
  //     userId: newUser.userId,
  //     name: newUser.name,
  //     email: newUser.email,
  //     avatar: newUser.avatarUrl,
  //     role: newUser.role,
  //   };

  //   this.logger.log(`User ${newUser.email} registered successfully`);

  //   return {
  //     ...payload,
  //   };
  // }

  public async getAllUsers() {
    return await this.prisma.user.findMany({
      select: {
        userId: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        phone: true,
        department: true,
        area: true,
        position: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        signature: true,
        manager: true,
        // subordinates: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    return await this.prisma.user.update({
      where: { userId },
      data: {
        status: updateUserDto?.status,
      },
    });
  }

  public async getLeaders() {
    return await this.prisma.user.findMany({
      where: {
        role: { in: ['LEADER', 'MANAGER'] },
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        name: true,
      },
    });
  }
}
