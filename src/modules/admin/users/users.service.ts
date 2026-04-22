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

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
