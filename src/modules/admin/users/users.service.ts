import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { hash } from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { randomUUID } from 'node:crypto';
import { CreateUserDto } from './dto/register.dto';
import { EmailService } from 'src/infrastructure/email/email.infra';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from 'src/infrastructure/cloudinary/cloudinary.infra';
import { BirthdayPostsResponseDto } from './dto/birthday-posts.dto';
import { SetUserModulesDto } from './dto/set-user-modules.dto';
import { Role } from 'generated/prisma/enums';
import { Modules } from 'src/common/enum/modules.enum';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { UpdateUsersAdminDto } from './dto/update-users-admin.dto';
import { LegalEntity } from './enum/legal-entity.enum';
import * as XLSX from 'xlsx';

type RowResult = {
  row: number;
  documentNumber: string;
  status: 'updated' | 'not_found' | 'error' | 'invalid';
  message?: string;
  userId?: string;
};

type ImportResult = {
  total: number;
  updated: number;
  notFound: number;
  errors: number;
  invalid: number;
  results: RowResult[];
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: EmailService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly encryptionService: EncryptionService,
  ) {}

  public async inviteUser(registerDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { documentNumber: registerDto.documentNumber },
    });

    if (existingUser) {
      this.logger.warn(
        `User invite rejected: User with document number ${registerDto.documentNumber} already exists (${registerDto.email})`,
      );
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

    let salaryEncrypted: string | null = null;
    if (registerDto.salary) {
      const enc = this.encryptionService.encrypt(String(registerDto.salary));
      salaryEncrypted = JSON.stringify(enc);
    }

    const password = await hash(registerDto.documentNumber, 10);

    const newUser = await this.prisma.user.create({
      data: {
        email: registerDto?.email,
        name: registerDto.name,
        role: registerDto.role,
        isLeader: registerDto.isLeader ?? registerDto.role === 'LEADER',
        status: 'ACTIVE',
        password,
        department: registerDto.department,
        area: registerDto.area,
        position: registerDto.position,
        leaderId: registerDto.leaderId,
        managerId: registerDto.managerId,
        birthDate: registerDto.birthDate,
        startDate: registerDto?.startDate,
        documentType: registerDto?.documentType,
        documentNumber: registerDto?.documentNumber,
        office: registerDto?.office,
        contractType: registerDto?.contractType,
        eps: registerDto?.eps,
        afp: registerDto?.afp,
        arl: registerDto?.arl,
        salary: salaryEncrypted,
        emergencyContactName: registerDto?.emergencyContactName,
        emergencyContactPhone: registerDto?.emergencyContactPhone,
        emergencyContactRel: registerDto?.emergencyContactRel,
        legalEntity: registerDto?.legalEntity,
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
      message: `Usuario creado con exito`,
      userId: newUser.userId,
    };
  }

  public async getUser(userId) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        name: true,
        role: true,
        isLeader: true,
        status: true,
        department: true,
        area: true,
        position: true,
        leaderId: true,
        managerId: true,
        birthDate: true,
        startDate: true,
        documentType: true,
        documentNumber: true,
        office: true,
        contractType: true,
        eps: true,
        afp: true,
        arl: true,
        salary: true,
        legalEntity: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRel: true,
      },
    });

    let salaryDecrypted: string | null = null;

    if (user?.salary) {
      const salary = JSON.parse(user?.salary || '{}') as {
        iv: string;
        encrypted: string;
        authTag: string;
      };

      salaryDecrypted = this.encryptionService.decrypt(
        salary.encrypted,
        salary.iv,
        salary.authTag,
      );
    }

    return {
      ...user,
      salary: salaryDecrypted,
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
        office: true,
        startDate: true,
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

  public async updateUserAdministrator(
    userId: string,
    updateUsersAdmiDto: UpdateUsersAdminDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) {
      throw new NotFoundException({
        message: `El usuario con el id: ${userId} no existe`,
        error: 'USER_NOT_FOUND',
      });
    }

    const { leaderId, managerId, salary, ...profileData } = updateUsersAdmiDto;

    let encryptedSalary: string | undefined;
    if (salary !== undefined) {
      const enc = this.encryptionService.encrypt(String(salary));
      encryptedSalary = JSON.stringify(enc);
    }

    return this.prisma.user.update({
      where: { userId },
      data: {
        ...profileData,
        ...(leaderId !== undefined && {
          leader: leaderId
            ? { connect: { userId: leaderId } }
            : { disconnect: true },
        }),
        ...(managerId !== undefined && {
          manager: managerId
            ? { connect: { userId: managerId } }
            : { disconnect: true },
        }),
        ...(encryptedSalary !== undefined && { salary: encryptedSalary }),
      },
    });
  }

  public async updateUserPermissions(
    userId: string,
    dto: SetUserModulesDto,
    grantedBy: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, role: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND',
      });
    }

    if (user.role === Role.ADMIN) {
      throw new ConflictException({
        message:
          'Loas ADMIN ya tienen acceso total; no se gestionan permisos por módulo.',
        error: 'USER_IS_ADMIN',
      });
    }

    const modules = [...new Set(dto.modules ?? [])];

    const invalid = modules.filter((m) => !Modules);

    await this.prisma.$transaction(async (tx) => {
      await tx.modulePermission.deleteMany({ where: { userId } });

      if (modules.length === 0) return;

      await tx.modulePermission.createMany({
        data: modules.map((module) => ({
          userId,
          module,
          canAccess: true,
          actions: dto.actions?.[module] ?? [],
          grantedBy,
        })),
        skipDuplicates: true,
      });
    });

    return await this.getUserPermissions(userId);
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

    this.logger.log(`User ${user.email} incactivated successfully`);

    return await this.prisma.user.delete({
      where: { userId },
    });
  }

  public async getUserDirectory(userId: string) {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', userId: { not: userId }, isUserTest: false },
      select: {
        userId: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        area: true,
        birthDate: true,
        phone: true,
        position: true,
        office: true,
        startDate: true,
        contractType: true,
        documentType: true,
        documentNumber: true,
        address: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRel: true,
        role: true,
        leaderId: true,
        managerId: true,
        leader: {
          select: {
            userId: true,
            name: true,
          },
        },
        manager: {
          select: {
            userId: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transformar para que el frontend reciba los campos planos que espera
    return users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      avatar: u.avatarUrl,
      avatarUrl: u.avatarUrl,
      department: u.department,
      area: u.area,
      birthDate: u.birthDate,
      phone: u.phone,
      position: u.position,
      office: u.office,
      startDate: u.startDate,
      contractType: u.contractType,
      documentType: u.documentType,
      documentNumber: u.documentNumber,
      address: u.address,
      emergencyContactName: u.emergencyContactName,
      emergencyContactPhone: u.emergencyContactPhone,
      emergencyContactRel: u.emergencyContactRel,
      role: u.role,
      leaderId: u.leaderId,
      leaderName: u.leader?.name || null,
      managerId: u.managerId,
      managerName: u.manager?.name || null,
    }));
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

  async getUsers() {
    return this.prisma.user.findMany();
  }

  public async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND',
      });
    }

    const perms = await this.prisma.modulePermission.findMany({
      where: { userId, canAccess: true },
      select: { module: true, actions: true },
      orderBy: { module: 'asc' },
    });

    const actionsRecord: Record<string, string[]> = {};
    perms.forEach((p) => {
      if (p.actions && p.actions.length > 0) {
        actionsRecord[p.module] = p.actions;
      }
    });

    return {
      userId,
      modules: perms.map((p) => p.module),
      actions: actionsRecord,
    };
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

  async importFromBuffer(
    buffer: Buffer,
    overrides: { legalEntity?: LegalEntity } = {},
  ): Promise<ImportResult> {
    // 1. Leer Excel
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    } catch (err) {
      throw new BadRequestException('El archivo no es un Excel válido');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('El Excel no contiene hojas');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    if (rows.length === 0) {
      throw new BadRequestException('El Excel no contiene filas de datos');
    }

    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // fila real en el Excel (1-based + header)

      const documentNumber = row['CC']
        ? String(row['CC'] as string).replace(/\D/g, '')
        : '';

      if (!documentNumber) {
        results.push({
          row: rowNumber,
          documentNumber: '',
          status: 'invalid',
          message: 'Fila sin CC',
        });
        continue;
      }

      // 2. Buscar usuario por documento
      const user = await this.prisma.user.findFirst({
        where: { documentNumber },
        select: { userId: true },
      });

      if (!user) {
        results.push({
          row: rowNumber,
          documentNumber,
          status: 'not_found',
          message: 'No existe un usuario con ese documento',
        });
        continue;
      }

      // 3. Armar el update
      const name = row['NOMBRES Y APELLIDOS']
        ? String(row['NOMBRES Y APELLIDOS'] as string).trim()
        : undefined;
      const position = row['CARGO']
        ? String(row['CARGO'] as string).trim()
        : undefined;
      const salary = this.parseNumber(row['SALARIO']);
      const startDate = this.parseDate(row['CONTRATO']);

      const rawLegalEntity = row['RAZÓN SOCIAL']
        ? String(row['RAZÓN SOCIAL'] as string)
        : undefined;
      const parsedLegalEntity =
        overrides.legalEntity ?? this.normalizeLegalEntity(rawLegalEntity);

      if (rawLegalEntity && !parsedLegalEntity && !overrides.legalEntity) {
        results.push({
          row: rowNumber,
          documentNumber,
          status: 'error',
          message: `Razón social no reconocida: "${rawLegalEntity}"`,
          userId: user.userId,
        });
        continue;
      }

      // 4. Encriptar salario si viene
      let encryptedSalary: string | undefined;
      if (salary !== null) {
        const enc = this.encryptionService.encrypt(String(salary));
        encryptedSalary = JSON.stringify(enc);
      }

      // 5. Update
      try {
        await this.prisma.user.update({
          where: { userId: user.userId },
          data: {
            ...(name !== undefined && { name }),
            ...(position !== undefined && { position }),
            ...(startDate !== null && { startDate }),
            ...(parsedLegalEntity && { legalEntity: parsedLegalEntity }),
            ...(encryptedSalary !== undefined && { salary: encryptedSalary }),
          },
        });

        results.push({
          row: rowNumber,
          documentNumber,
          status: 'updated',
          userId: user.userId,
        });
      } catch (err) {
        this.logger.error(`Error actualizando usuario ${user.userId}`, err);
        results.push({
          row: rowNumber,
          documentNumber,
          status: 'error',
          message: err instanceof Error ? err.message : 'Error desconocido',
          userId: user.userId,
        });
      }
    }

    return {
      total: rows.length,
      updated: results.filter((r) => r.status === 'updated').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
      errors: results.filter((r) => r.status === 'error').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      results,
    };
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

  private normalizeLegalEntity(raw?: string): LegalEntity | null {
    if (!raw) return null;

    const normalized = raw
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z_]/g, '');

    const keys = Object.keys(LegalEntity) as (keyof typeof LegalEntity)[];
    const key = keys.find((k) => k === normalized);
    return key ? LegalEntity[key] : null;
  }

  private parseDate(raw: unknown): Date | null {
    if (raw == null || raw === '') return null;

    // Serial de Excel (número de días desde 1900-01-01)
    if (typeof raw === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const ms = raw * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + ms);
      return isNaN(date.getTime()) ? null : date;
    }

    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

    const str = String(raw as string).trim();
    if (!str) return null;

    // "23/02/2026" (DD/MM/YYYY)
    const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return isNaN(date.getTime()) ? null : date;
    }

    // Cualquier otro formato que Date pueda interpretar (ISO, etc.)
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseNumber(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return raw;
    // Limpia "$1.234.567,89" o "1,234,567.89" o "1234567"
    const cleaned = String(raw as string)
      .replace(/[^\d.,-]/g, '')
      .replace(/\.(?=\d{3}\b)/g, '') // quita puntos de miles
      .replace(',', '.');
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
}
