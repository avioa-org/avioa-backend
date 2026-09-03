import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { CreatePasswordDto } from './dto/create-password.dto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Prisma } from 'generated/prisma/client';
import {
  SearchPasswordVaultDto,
  VaultScope,
} from './dto/search-password-vault.dto';
import * as crypto from 'crypto';
import { ShareVaultDto, UpdatePermissionDto } from './dto/share-vault.dto';
import { TwoFactorService } from 'src/infrastructure/two-factor/two-factor.service';
import { RevealPasswordDto } from './dto/reveal-password.dto';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { PasswordVaultGateway } from './password-vault.gateway';

interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean; // O,0,l,I,1
}

enum StrengthLevel {
  VERY_WEAK = 'VERY_WEAK',
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG',
  VERY_STRONG = 'VERY_STRONG',
}

const COMMON_PASSWORDS = new Set([
  '123456',
  'password',
  'admin123',
  'qwerty',
  '12345678',
  'contraseña',
  'empresa2025',
  '123456789',
  'letmein',
  'welcome',
  'avioa',
]);

export class PasswordMapper {
  static toRespone(password: any) {
    return {
      passwordVaultId: password.passwordVaultId,
      title: password.title,
      username: password.username,
      email: password.email,
      website: password.website,
      notes: password.notes,
      favorite: password.favorite,
      categoryId: password.categoryId,
      strengthLevel: password.strengthLevel,
      createdAt: password.createdAt,
      updatedAt: password.updatedAt,
      ...(password.daysRemainig && { daysRemainig: password.daysRemainig }),
    };
  }
}

@Injectable()
export class PasswordVaultService {
  private readonly SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  };

  private readonly SIMILAR = new Set(['O', '0', 'l', 'I', '1']);

  private readonly logger = new Logger(PasswordVaultService.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly twoFactorService: TwoFactorService,
    private readonly passwordVaultGateway: PasswordVaultGateway,
    private readonly prisma: PrismaService,
  ) {}

  public async create(userId: string, dto: CreatePasswordDto) {
    const encrypted = this.encryptionService.encrypt(dto.password);
    const passwordHash = this.encryptionService.hash(dto.password);

    const password = await this.prisma.$transaction(async (tx) => {
      const created = await tx.passwordVault.create({
        data: {
          ownerId: userId,
          title: dto.title,
          username: dto.username,
          email: dto.email,
          website: dto.website,
          notes: dto.notes,
          categoryId: dto.categoryId,
          expiresAt: dto.expiresAt,
          rotationDays: dto.rotationDays,
          passwordEncrypted: encrypted.encrypted,
          passwordIv: encrypted.iv,
          passwordAuthTag: encrypted.authTag,
          passwordHash: passwordHash,
          strengthLevel: this.evaluatePassword(dto.password).level,
          tags: dto.tagIds
            ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      });

      await tx.passwordAudit.create({
        data: {
          vaultId: created.passwordVaultId,
          userId,
          action: 'CREATED',
        },
      });

      return created;
    });

    return PasswordMapper.toRespone(password);
  }

  public async update(userId: string, vaultId: string, dto: UpdatePasswordDto) {
    await this.assertCanEdit(userId, vaultId);

    const existing = await this.prisma.passwordVault.findUniqueOrThrow({
      where: { passwordVaultId: vaultId, deletedAt: null },
    });

    const changedFields: string[] = [];
    const data: Prisma.PasswordVaultUpdateInput = {};

    if (dto.title !== undefined && dto.title !== existing.title) {
      data.title = dto.title;
      changedFields.push('title');
    }

    if (dto.username !== undefined && dto.username !== existing.username) {
      data.username = dto.username;
      changedFields.push('username');
    }

    if (dto.email !== undefined && dto.email !== existing.email) {
      data.email = dto.email;
      changedFields.push('email');
    }

    if (dto.website !== undefined && dto.website !== existing.website) {
      data.website = dto.website;
      changedFields.push('website');
    }

    if (dto.notes !== undefined && dto.notes !== existing.notes) {
      data.notes = dto.notes;
      changedFields.push('notes');
    }

    if (
      dto.rotationDays !== undefined &&
      dto.rotationDays !== existing.rotationDays
    ) {
      data.rotationDays = dto.rotationDays;
      changedFields.push('rotationDays');
    }

    if (dto.expiresAt !== undefined && dto.expiresAt !== existing.expiresAt) {
      data.expiresAt = dto.expiresAt;
      changedFields.push('expiresAt');
    }

    let newEncrypted: {
      encrypted: string;
      iv: string;
      authTag: string;
    } | null = null;

    if (dto.password) {
      newEncrypted = this.encryptionService.encrypt(dto.password);
      data.passwordEncrypted = newEncrypted.encrypted;
      data.passwordIv = newEncrypted.encrypted;
      data.passwordAuthTag = newEncrypted.authTag;
      data.passwordHash = this.encryptionService.hash(dto.password);
      data.strengthLevel = this.evaluatePassword(dto.password).level;
      changedFields.push('password');
    }

    if (changedFields.length === 0) {
      return PasswordMapper.toRespone(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newEncrypted) {
        const versionCount = await tx.passwordVersion.count({
          where: { vaultId },
        });

        await tx.passwordVersion.create({
          data: {
            vaultId: vaultId,
            changedById: userId,
            versionNumber: versionCount + 1,
            passwordEncrypted: existing.passwordEncrypted,
            passwordIv: existing.passwordIv,
            passwordAuthTag: existing.passwordAuthTag,
            changedFields,
          },
        });
      }

      const result = await tx.passwordVault.update({
        where: { passwordVaultId: vaultId },
        data,
      });

      await tx.passwordAudit.create({
        data: { vaultId, userId, action: 'UPDATED' },
      });

      return result;
    });

    return PasswordMapper.toRespone(updated);
  }

  public async softDelete(userId: string, vaultId: string) {
    await this.assetCanAdmin(userId, vaultId);

    await this.prisma.$transaction([
      this.prisma.passwordVault.update({
        where: { passwordVaultId: vaultId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.passwordAudit.create({
        data: { vaultId, userId, action: 'DELETED' },
      }),
    ]);
  }

  public async restore(userId: string, vaultId: string) {
    await this.assetCanAdmin(userId, vaultId, true);

    await this.prisma.$transaction([
      this.prisma.passwordVault.update({
        where: { passwordVaultId: vaultId },
        data: { deletedAt: null },
      }),
      this.prisma.passwordAudit.create({
        data: { vaultId, userId, action: 'RESTORED' },
      }),
    ]);

    return {
      vault: await this.prisma.passwordVault.findFirstOrThrow({
        where: { passwordVaultId: vaultId, deletedAt: null },
        select: {
          passwordVaultId: true,
          title: true,
          username: true,
          email: true,
          website: true,
          notes: true,
          favorite: true,
        },
      }),
    };
  }

  // Esto esun Job - borra definitivamente tras 30 dias en papelera
  public async purgeExpiredTrash() {
    const threshold = new Date();

    threshold.setDate(threshold.getDate() - 30);

    await this.prisma.passwordVault.deleteMany({
      where: { deletedAt: { lte: threshold } },
    });
  }

  public async toggleFavorite(userId: string, vaultId: string) {
    await this.assertCanView(userId, vaultId);

    const vault = await this.prisma.passwordVault.findFirstOrThrow({
      where: { passwordVaultId: vaultId, deletedAt: null },
    });

    return this.prisma.passwordVault.update({
      where: { passwordVaultId: vaultId },
      data: { favorite: !vault.favorite },
    });
  }

  public async findAll(userId: string, query: SearchPasswordVaultDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { userId },
      select: { department: true, area: true },
    });

    const accessOr: Prisma.PasswordVaultWhereInput[] = [
      { ownerId: userId },
      { permissions: { some: { userId } } },
      ...(user.area
        ? [{ permissions: { some: { department: user.area } } }]
        : []),
    ];

    let where: Prisma.PasswordVaultWhereInput = {
      deletedAt: null,
      OR: accessOr,
    };

    if (query.scope === VaultScope.OWN) {
      where = { deletedAt: null, ownerId: userId };
    } else if (query.scope === VaultScope.SHARED) {
      where = {
        deletedAt: null,
        ownerId: { not: userId },
        OR: accessOr.slice(1),
      };
    }

    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { username: { contains: query.search, mode: 'insensitive' } },
            { website: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.favorite !== undefined) where.favorite = query.favorite;
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.passwordVault.findMany({
        where,
        include: {
          category: true,
          tags: { include: { tag: true } },
          owner: { select: { userId: true, name: true } },

          // Aqui solo traigo los permisos relevantes a este usuario, no todos los de la credencial
          permissions: {
            where: {
              OR: [
                { userId },
                ...(user.area ? [{ department: user.area }] : []),
              ],
            },
          },
        },
        skip: query.skip,
        take: query.take,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      }),
      this.prisma.passwordVault.count({ where }),
    ]);

    const mapped = items.map((vault) => {
      const isOwner = vault.ownerId === userId;
      const directPermission = vault.permissions.find(
        (p) => p.userId === userId,
      );
      const departmentPermission = vault.permissions.find(
        (p) => p.department === user.area,
      );

      // verificacion de la password comparita tanto personalmente como por area
      let sharedVia: 'owner' | 'direct' | 'department' | 'both' | null = null;
      if (!isOwner) {
        if (directPermission && departmentPermission) sharedVia = 'both';
        else if (directPermission) sharedVia = 'direct';
        else if (departmentPermission) sharedVia = 'department';
      }

      const effective = {
        canEdit:
          isOwner ||
          !!directPermission?.canEdit ||
          !!departmentPermission?.canEdit,
        canAdmin:
          isOwner ||
          !!directPermission?.canAdmin ||
          !!departmentPermission?.canAdmin,
      };

      const base = PasswordMapper.toRespone(vault);

      return {
        ...base,
        isOwner,
        sharedVia,
        sharedByName: !isOwner ? vault.owner.name : undefined,
        canEdit: effective.canEdit,
        canAdmin: effective.canAdmin,
      };
    });

    return { items: mapped, total };
  }

  public async reveal(
    userId: string,
    vaultId: string,
    verifyDto: RevealPasswordDto,
    meta: { ip?: string; userAgent?: string },
  ) {
    await this.assertCanView(userId, vaultId);
    await this.twoFactorService.verifyOrFallback(userId, verifyDto);

    const vault = await this.prisma.passwordVault.findFirstOrThrow({
      where: { passwordVaultId: vaultId, deletedAt: null },
    });

    const plain = this.encryptionService.decrypt(
      vault.passwordEncrypted,
      vault.passwordIv,
      vault.passwordAuthTag,
    );

    await this.prisma.passwordAudit.create({
      data: {
        vaultId,
        userId,
        action: 'VIEWED',
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { password: plain, hideAfterSeconds: 15 }; // esto el frontend lo debe ocultar despues de ciertos segundos
  }

  public async logCopy(
    userId: string,
    vaultId: string,
    field: 'USERNAME' | 'PASSWORD',
    meta: { ip?: string; userAgent?: string },
  ) {
    await this.prisma.passwordAudit.create({
      data: {
        vaultId,
        userId,
        action: field === 'PASSWORD' ? 'COPIED_PASSWORD' : 'COPIED_USERNAME',
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  generate(options: GeneratorOptions) {
    let pool = '';
    const guaranteed: string[] = [];

    if (options.uppercase) {
      const set = this.filterSimilar(
        this.SETS.uppercase,
        options.excludeSimilar,
      );
      pool += set;
      guaranteed.push(this.randomChar(set));
    }

    if (options.lowercase) {
      const set = this.filterSimilar(
        this.SETS.lowercase,
        options.excludeSimilar,
      );
      pool += set;
      guaranteed.push(this.randomChar(set));
    }

    if (options.numbers) {
      const set = this.filterSimilar(this.SETS.numbers, options.excludeSimilar);
      pool += set;
      guaranteed.push(this.randomChar(set));
    }

    if (options.symbols) {
      pool += this.SETS.symbols;
      guaranteed.push(this.randomChar(this.SETS.symbols));
    }

    if (!pool) {
      throw new Error('Debes selecionar al menos un tipo de carácter');
    }

    const remainingLength = Math.max(options.length - guaranteed.length, 0);
    const rest = Array.from({ length: remainingLength }, () =>
      this.randomChar(pool),
    );

    return this.shuffle([...guaranteed, ...rest])
      .join('')
      .slice(0, options.length);
  }

  async share(actingUserId: string, vaultId: string, dto: ShareVaultDto) {
    await this.assetCanAdmin(actingUserId, vaultId);

    if (!dto.userId && !dto.department) {
      throw new BadRequestException('Debes indicar un usuario o un area');
    }

    if (dto.userId && dto.department) {
      throw new BadRequestException(
        'No puedes compartir un vault con un usuario y una area al mismo tiempo',
      );
    }

    const permission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.passwordPermission.create({
        data: {
          vault: {
            connect: {
              passwordVaultId: vaultId,
            },
          },

          ...(dto.userId
            ? {
                user: {
                  connect: {
                    userId: dto.userId,
                  },
                },
              }
            : {
                area: dto.department,
              }),

          canView: dto.canView,
          canEdit: dto.canEdit,
          canAdmin: dto.canAdmin,
        },
      });

      await tx.passwordAudit.create({
        data: { vaultId, userId: actingUserId, action: 'SHARED' },
      });

      if (dto.userId) {
        this.passwordVaultGateway.emitPasswordSharedToUser(created, dto.userId);
      }

      if (dto.department) {
        this.passwordVaultGateway.emitPasswordSharedToArea(
          created,
          dto.department,
        );
      }

      return created;
    });

    return permission;
  }

  async updatePermission(
    actingUserId: string,
    permissionId: string,
    dto: UpdatePermissionDto,
  ) {
    const permission = await this.prisma.passwordPermission.findUniqueOrThrow({
      where: { passwordPermissionId: permissionId },
    });

    await this.assetCanAdmin(actingUserId, permission.vaultId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.passwordPermission.update({
        where: { passwordPermissionId: permissionId },
        data: dto,
      });

      await tx.passwordAudit.create({
        data: {
          vaultId: permission.vaultId,
          userId: actingUserId,
          action: 'PERMISSION_CHANGED',
        },
      });

      return result;
    });

    return updated;
  }

  async revoke(actingUserId: string, permissionId: string) {
    const permission = await this.prisma.passwordPermission.findUniqueOrThrow({
      where: { passwordPermissionId: permissionId },
    });

    await this.assetCanAdmin(actingUserId, permission.vaultId);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordPermission.delete({
        where: { passwordPermissionId: permissionId },
      });
      await tx.passwordAudit.create({
        data: {
          vaultId: permission.vaultId,
          userId: actingUserId,
          action: 'PERMISSION_CHANGED',
        },
      });
    });
  }

  async listSharedWith(vaultId: string) {
    return await this.prisma.passwordPermission.findMany({
      where: { vaultId },
      include: { user: { select: { userId: true, name: true, email: true } } },
    });
  }

  async findAllCategories() {
    return await this.prisma.passwordCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { vaults: { where: { deletedAt: null } } },
        },
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.passwordCategory.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una categoría con ese nombre');
    }

    return this.prisma.passwordCategory.create({ data: dto });
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto) {
    await this.assertExistsCategory(categoryId);

    return this.prisma.passwordCategory.update({
      where: { passwordCategoryId: categoryId },
      data: dto,
    });
  }

  async deleteCategory(categoryId: string) {
    await this.assertExistsCategory(categoryId);

    const inUse = await this.prisma.passwordVault.count({
      where: { categoryId, deletedAt: null },
    });

    if (inUse > 0) {
      throw new BadRequestException(
        `No puedes eliminar esta categoría: ${inUse} credencial(es) la están usando`,
      );
    }

    await this.prisma.passwordCategory.delete({
      where: { passwordCategoryId: categoryId },
    });
  }

  // Tags
  async findAllTags() {
    return this.prisma.passwordTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { vaults: true },
        },
      },
    });
  }

  async findOrCreateTag(dto: CreateTagDto) {
    const existing = await this.prisma.passwordTag.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });

    if (existing) return existing;

    return this.prisma.passwordTag.create({ data: { name: dto.name.trim() } });
  }

  async deleteTag(tagId: string) {
    const tag = await this.prisma.passwordTag.findUnique({
      where: { passwordTagId: tagId },
    });
    if (!tag) throw new NotFoundException('Etiqueta no encontrada');

    await this.prisma.$transaction([
      this.prisma.passwordTagOnVault.deleteMany({ where: { tagId } }),
      this.prisma.passwordTag.delete({ where: { passwordTagId: tagId } }),
    ]);
  }

  public async findTrash(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { userId },
      select: { department: true, area: true },
    });

    const items = await this.prisma.passwordVault.findMany({
      where: {
        ownerId: userId,
        deletedAt: { not: null },
      },
      include: { category: true },
      orderBy: { deletedAt: 'desc' },
    });

    const now = new Date();

    return items.map((vault) => {
      const deletedAt = vault.deletedAt as Date;
      const purgeAt = new Date(deletedAt);
      purgeAt.setDate(purgeAt.getDate() + 30);
      const daysRemainig = Math.max(
        0,
        Math.ceil((purgeAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const data = PasswordMapper.toRespone({ ...vault, daysRemainig });
      return data;
    });
  }

  public async permanentDelete(userId: string, vaultId: string) {
    const vault = await this.prisma.passwordVault.findFirst({
      where: {
        passwordVaultId: vaultId,
        ownerId: userId,
        deletedAt: { not: null },
      },
    });

    if (!vault) {
      throw new NotFoundException('Credencial no encontrada en la papelera');
    }

    await this.prisma.passwordVault.delete({
      where: { passwordVaultId: vaultId },
    });
  }

  private async assertExistsCategory(categoryId: string) {
    const category = await this.prisma.passwordCategory.findUnique({
      where: { passwordCategoryId: categoryId },
    });

    if (!category) throw new NotFoundException('La categoría no encontrada');
  }

  private evaluatePassword(password: string): {
    score: number;
    level: StrengthLevel;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      score = 0;
      issues.push('Esta es una contraseña común y fácil de adivinar');
    }

    if (/^(.)\1+$/.test(password)) {
      score = Math.min(score, 1);
      issues.push('No repitas el mismo carácter');
    }

    if (/^(012|123|234|345|456|567|678|789|890)+/.test(password)) {
      issues.push('Evita secuencias numéricas obvias');
      score = Math.max(score - 1, 0);
    }

    if (password.length < 8) {
      issues.push('Debe tener al menos 8 caracteres');
    }

    const level = this.scoreToLevel(score);

    return { score, level, issues };
  }

  private scoreToLevel(score: number): StrengthLevel {
    if (score <= 1) return StrengthLevel.VERY_WEAK;
    if (score <= 3) return StrengthLevel.WEAK;
    if (score <= 5) return StrengthLevel.MEDIUM;
    if (score <= 6) return StrengthLevel.STRONG;
    return StrengthLevel.VERY_STRONG;
  }

  private async assertCanView(userId: string, vaultId: string) {
    const vault = await this.resolveVaultAccess(userId, vaultId);
    if (!vault)
      throw new ForbiddenException('No tienes acceso a esta credencial');
  }

  private filterSimilar(charset: string, exclude: boolean): string {
    if (!exclude) return charset;
    return charset
      .split('')
      .filter((c) => !this.SIMILAR.has(c))
      .join('');
  }

  private randomChar(charset: string): string {
    const index = crypto.randomInt(0, charset.length);
    return charset[index];
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private async resolveVaultAccess(
    userId: string,
    vaultId: string,
    restore?: boolean,
  ) {
    this.logger.debug('userId', userId, 'vaultId', vaultId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { userId },
      select: { department: true, area: true },
    });

    const vault = await this.prisma.passwordVault.findFirst({
      where: {
        passwordVaultId: vaultId,
        ...(restore ? {} : { deletedAt: null }),
        OR: [
          { ownerId: userId },
          { permissions: { some: { userId } } },
          ...(user.area
            ? [{ permissions: { some: { department: user.area } } }]
            : []),
        ],
      },
      include: {
        permissions: {
          where: {
            OR: [{ userId }, ...(user.area ? [{ department: user.area }] : [])],
          },
        },
      },
    });

    return vault;
  }

  private async assertCanEdit(userId: string, vaultId: string) {
    const vault = await this.resolveVaultAccess(userId, vaultId);
    const isOwner = vault?.ownerId === userId;
    const hasEdit = vault?.permissions.some((p) => p.canEdit || p.canAdmin);
    if (!vault || (!isOwner && !hasEdit))
      throw new ForbiddenException('No tienes permiso de edición');
  }

  private async assetCanAdmin(
    userId: string,
    vaultId: string,
    restore?: boolean,
  ) {
    const vault = await this.resolveVaultAccess(userId, vaultId, restore);
    const isOwner = vault?.ownerId === userId;
    const hasAdmin = vault?.permissions.some((p) => p.canAdmin);
    if (!vault || (!isOwner && !hasAdmin)) {
      throw new ForbiddenException('No tienes permiso de administración');
    }
  }

  private async pwnedPasswordCheck(password: string): Promise<number> {
    const hash = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
      );

      if (!response.ok) {
        this.logger.error(
          `Fallo al checkear el pwned password: ${response.status}`,
        );
        return 0;
      }

      const body = await response.text();

      const lines = body.split('\n');

      for (const line of lines) {
        const [partsSuffix, count] = line.trim().split(':');

        if (partsSuffix === suffix) {
          return parseInt(count, 10);
        }
      }

      return 0; // No se encontro ninguna coincidencia
    } catch (error) {
      this.logger.error(`Fallo al checkear el pwned password: ${error}`);
      return 0;
    }
  }
}
