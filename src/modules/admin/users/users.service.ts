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
import { randomBytes, randomUUID } from 'node:crypto';
import { envs } from 'src/config/env.config';
import { CreateUserDto } from './dto/register.dto';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from 'src/infrastructure/cloudinary/cloudinary.infra';
import { BirthdayPostsResponseDto } from './dto/birthday-posts.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: EmailService,
    private readonly cloudinaryService: CloudinaryService,
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
      const leader = await this.prisma.user.findFirst({
        where: {
          userId: registerDto.leaderId,
          OR: [{ role: 'LEADER' }, { isLeader: true }],
        },
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
        isLeader: registerDto.isLeader ?? registerDto.role === 'LEADER',
        status: 'PENDING',
        password: null,
        department: registerDto.department,
        area: registerDto.area,
        position: registerDto.position,
        leaderId: registerDto.leaderId,
        managerId: registerDto.managerId,
        inviteToken,
        inviteExpires,
        birthDate: registerDto.birthDate,
        startDate: registerDto?.startDate,
        documentType: registerDto?.documentType,
        documentNumber: registerDto?.documentNumber,
        office: registerDto?.office,
        contractType: registerDto?.contractType,
        eps: registerDto?.eps,
        afp: registerDto?.afp,
        arl: registerDto?.arl,
        salary: registerDto?.salary,
        emergencyContactName: registerDto?.emergencyContactName,
        emergencyContactPhone: registerDto?.emergencyContactPhone,
        emergencyContactRel: registerDto?.emergencyContactRel,
      },
    });

    // Aca se envia el correo
    // await this.mailService.sendInvite({
    //   to: newUser.email,
    //   subject: 'Invitación a Avioa',
    //   inviteUrl: `${envs.FRONTEND_URL}/invite?token=${inviteToken}`,
    // });

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
      where: {
        AND: [{ NOT: { name: 'lider test' } }, { NOT: { name: 'testing' } }],
      },
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
        birthDate: true,
        // subordinates: true,
        status: true,
        vacationDaysAdjustment: true,
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
        ...(updateUserDto?.isLeader !== undefined && {
          isLeader: updateUserDto.isLeader,
        }),
        ...(updateUserDto?.vacationDaysAdjustment !== undefined && {
          vacationDaysAdjustment: updateUserDto.vacationDaysAdjustment,
        }),
      },
    });
  }

  public async getLeaders() {
    return await this.prisma.user.findMany({
      where: {
        OR: [{ role: { in: ['LEADER', 'MANAGER'] } }, { isLeader: true }],
        status: 'ACTIVE',
        isUserTest: false,
      },
      select: {
        userId: true,
        name: true,
      },
    });
  }

  public async resendInvite(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const inviteToken = randomUUID();
    const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

    await this.prisma.user.update({
      where: { userId },
      data: {
        inviteToken,
        inviteExpires,
      },
    });

    // await this.mailService.sendInvite({
    //   to: user.email,
    //   subject: 'Invitación a Avioa',
    //   inviteUrl: `${envs.FRONTEND_URL}/invite?token=${inviteToken}`,
    // });

    this.logger.log(`Invite resent to ${user.email}`);

    return {
      message: `Invitación enviada a ${user.email}`,
      userId: user.userId,
    };
  }

  public async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    this.logger.log(`User ${user.email} deleted successfully`);

    return await this.prisma.user.delete({ where: { userId } });
  }

  public async getUserDirectory(userId: string) {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE', userId: { not: userId } },
      select: {
        userId: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        area: true,
        birthDate: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  public async updateProfile(
    updateProfileDto: UpdateProfileDto,
    userId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new NotFoundException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const { file, ...profileData } = updateProfileDto;

    const selectedFields = Object.keys(profileData).reduce(
      (acc, k) => {
        acc[k] = true;
        return acc;
      },
      { avatarUrl: true } as Record<string, boolean>,
    );

    let publicId: string | null = null;

    try {
      let avatarUrl: string | undefined;

      if (file) {
        const uploaded = await this.cloudinaryService.uploadBufferToCloudinary(
          file[0].buffer,
        );
        avatarUrl = uploaded.secure_url;
        publicId = uploaded.public_id;
      }

      const updatedUser = await this.prisma.user.update({
        where: { userId },
        data: {
          ...profileData,
          ...(avatarUrl && { avatarUrl }),
        },
        select: selectedFields,
      });

      return updatedUser;
    } catch (err) {
      this.logger.error(err);

      if (publicId) {
        try {
          await this.cloudinaryService.deleteImage(publicId);
        } catch (deleteErr) {
          this.logger.error(
            `No se pudo eliminar la imagen de Cloudinary: ${deleteErr}`,
            deleteErr,
          );
        }
      }
    }
  }

  public searchUser(query: string, excludeUserId: string) {
    if (!query || query.trim().length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        userId: { not: excludeUserId },
        name: { contains: query, mode: 'insensitive' },
        status: 'ACTIVE',
      },
      select: { userId: true, name: true, avatarUrl: true, role: true },
      take: 8,
    });
  }

  public async getLeadersDb() {
    const normalized = (s: string) => {
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const users = await this.prisma.user.findMany();

    const leaders = users.filter((user) => {
      return normalized(user.position ?? '').includes(normalized('lider'));
    });

    return leaders;
  }

  private getInitials(name: string | null | undefined): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase();
  }

  // Obtener todos los usuarios (puedes reutilizar el método existente)
  async getUsers() {
    return this.prisma.user.findMany();
  }

  // Obtener cumpleaños del mes actual
  private getCurrentMonthBirthdays(users: any[]): any[] {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const birthdayUsers = users.filter((user) => {
      if (!user.birthDate) return false;
      try {
        const birthDate = new Date(user.birthDate);
        if (isNaN(birthDate.getTime())) return false;
        return birthDate.getMonth() === currentMonth;
      } catch {
        return false;
      }
    });

    if (birthdayUsers.length === 0) return [];

    return birthdayUsers.map((user) => {
      const birthDate = new Date(user.birthDate);
      const day = birthDate.getDate().toString().padStart(2, '0');
      const month = birthDate.toLocaleString('es', { month: 'long' });
      const dateThisYear = new Date(
        currentYear,
        birthDate.getMonth(),
        birthDate.getDate(),
      );
      const isWeekend =
        dateThisYear.getDay() === 0 || dateThisYear.getDay() === 6;

      return {
        id: user.userId,
        name: user.name,
        day,
        month,
        isWeekend,
        employee: {
          id: user.userId,
          name: user.name,
          role: user.position || user.role || 'Empleado',
          initials: this.getInitials(user.name),
          avatarUrl: user.avatarUrl,
        },
      };
    });
  }

  // Obtener cumpleaños de hoy
  private getTodayBirthdays(users: any[]): any[] {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const birthdayUsers = users.filter((user) => {
      if (!user.birthDate) return false;
      try {
        const birthDate = new Date(user.birthDate);
        if (isNaN(birthDate.getTime())) return false;
        return (
          birthDate.getMonth() === currentMonth &&
          birthDate.getDate() === currentDay
        );
      } catch {
        return false;
      }
    });

    return birthdayUsers.map((user) => {
      const birthDate = new Date(user.birthDate);
      return {
        id: user.userId,
        name: user.name,
        day: birthDate.getDate().toString().padStart(2, '0'),
        month: birthDate.toLocaleString('es', { month: 'long' }),
        isWeekend: false,
        employee: {
          id: user.userId,
          name: user.name,
          role: user.position || user.role || 'Empleado',
          initials: this.getInitials(user.name),
          avatarUrl: user.avatarUrl,
        },
      };
    });
  }

  // Generar publicaciones de cumpleaños
  private generateBirthdayPosts(users: any[]): any[] {
    const todayBirthdays = this.getTodayBirthdays(users);
    if (todayBirthdays.length === 0) return [];

    const companyName = 'Avioa';
    const companyInitials = 'AV';

    return todayBirthdays.map((birthday) => {
      const message = `¡Feliz Cumpleaños ${birthday.name}!

${birthday.employee.role ? `Cargo: ${birthday.employee.role}` : ''}

${birthday.day && birthday.month ? `Fecha: ${birthday.day} de ${birthday.month}` : ''}

Todo el equipo de ${companyName} te desea un día lleno de alegría, éxitos y momentos inolvidables. ¡Gracias por ser parte de nuestra gran familia!

¡Disfruta tu día al máximo!`;

      return {
        id: `birthday-${Date.now()}-${birthday.id}`,
        author: companyName,
        authorAvatar: companyInitials,
        authorRole: 'Recursos Humanos',
        content: message,
        timestamp: new Date().toISOString(),
        likes: 0,
        comments: 0,
        shares: 0,
        liked: false,
        commentsList: [],
        isBirthdayPost: true,
        birthdayPerson: birthday.name,
      };
    });
  }

  // Método principal para obtener publicaciones de cumpleaños
  async getBirthdayPosts(): Promise<BirthdayPostsResponseDto> {
    // Obtener todos los usuarios
    const users = await this.getUsers();

    if (!users || users.length === 0) {
      return {
        birthdayPosts: [],
        todayBirthdays: [],
        monthBirthdays: [],
        generatedAt: new Date().toISOString(),
        count: {
          birthdayPosts: 0,
          todayBirthdays: 0,
          monthBirthdays: 0,
        },
      };
    }

    // Generar datos
    const birthdayPosts = this.generateBirthdayPosts(users);
    const todayBirthdays = this.getTodayBirthdays(users);
    const monthBirthdays = this.getCurrentMonthBirthdays(users);

    return {
      birthdayPosts,
      todayBirthdays,
      monthBirthdays,
      generatedAt: new Date().toISOString(),
      count: {
        birthdayPosts: birthdayPosts.length,
        todayBirthdays: todayBirthdays.length,
        monthBirthdays: monthBirthdays.length,
      },
    };
  }
}
