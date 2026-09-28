import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { FeedGateway } from '../feed/feed.gateway';
import { Cron } from '@nestjs/schedule';
import { envs } from 'src/config/env.config';
import { DEFAULT_TEMPLATES } from './birthday-template';

@Injectable()
export class BirthdaysService {
  private readonly logger = new Logger(BirthdaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feedService: FeedService,
    private readonly feedGateway: FeedGateway,
  ) {}

  @Cron('* * * * *', {
    timeZone: 'America/Bogota',
    name: 'daily-birthdays',
  })
  async handleDailyBirthdays() {
    this.logger.log('[cron] Iniciando proceso de cumpleaños...');
    try {
      const results = await this.generateBirthdayPostsForToday();
      this.logger.log(
        `[cron] Procesados ${results.created} cumpleaños nuevos (${results.skipped}) ya existían`,
      );
    } catch (error) {
      this.logger.error('[cron] Error procesando cumpleaños');
    }
  }

  async generateBirthdayPostsForToday(): Promise<{
    created: number;
    skipped: number;
  }> {
    const today = this.startOfToday();
    const tomorrow = this.endOfToday();

    const birthdays = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isUserTest: false,
        birthDate: {
          not: null,
        },
      },
      select: {
        userId: true,
        name: true,
        department: true,
        position: true,
        birthDate: true,
      },
    });

    const todayBirthdays = birthdays.filter((u) => {
      const d = new Date(u.birthDate!);
      return (
        d.getUTCDate() === today.getUTCDate() &&
        d.getUTCMonth() === today.getUTCMonth()
      );
    });

    let created = 0;
    let skipped = 0;

    for (const user of todayBirthdays) {
      const existing = await this.prisma.feedPost.findFirst({
        where: {
          type: 'BIRTHDAY',
          recognizedUserId: user.userId,
          deletedAt: null,
          createdAt: { gte: today, lt: tomorrow },
        },
        select: { feedPostId: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const post = await this.createBirthdayPost(user);
      created++;

      this.feedGateway.emitNewPost(post);
    }

    return { created, skipped };
  }

  async getMyBirthdayStatus(userId: string) {
    const today = this.startOfToday();
    const tomorrow = this.endOfToday();

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        birthDate: true,
        birthdayCelebrationSeenAt: true,
      },
    });

    if (!user || !user.birthDate) {
      return { isBirthday: false, alreadySeen: true };
    }

    const d = new Date(user.birthDate);
    const isBirthday =
      d.getUTCDate() === today.getUTCDate() &&
      d.getUTCMonth() === today.getUTCMonth();

    if (!isBirthday) {
      return { isBirthday: false, alreadySeen: true };
    }

    const alreadySeen =
      user.birthdayCelebrationSeenAt != null &&
      user.birthdayCelebrationSeenAt >= today;

    // Buscar el post del día para poder linkearlo
    const post = await this.prisma.feedPost.findFirst({
      where: {
        type: 'BIRTHDAY',
        recognizedUserId: userId,
        deletedAt: null,
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { feedPostId: true },
    });

    return {
      isBirthday: true,
      alreadySeen,
      feedPostId: post?.feedPostId ?? null,
      firstName: user.name.split(' ')[0],
    };
  }

  async markCelebrationSeen(userId: string) {
    await this.prisma.user.update({
      where: { userId },
      data: { birthdayCelebrationSeenAt: new Date() },
    });
    return { success: true };
  }

  private async createBirthdayPost(user: {
    userId: string;
    name: string;
    department: string | null;
    position: string | null;
  }) {
    const content = await this.renderTemplate(user);
    const authorId = await this.resolveSystemAuthorId();

    const post = await this.prisma.feedPost.create({
      data: {
        authorId,
        type: 'BIRTHDAY',
        content,
        recognizedUserId: user.userId,
        images: [],
      },
      include: {
        author: {
          select: {
            userId: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        recognizedUser: {
          select: {
            userId: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        _count: { select: { reactions: true } },
        reactions: [] as any,
        comments: [] as any,
      },
    });

    return this.feedService['mapPost'](post, authorId);
  }

  private async renderTemplate(user: {
    name: string;
    department: string | null;
    position: string | null;
  }): Promise<string> {
    const firstName = user.name.split(' ')[0];

    const dbTemplates = await this.prisma.birthdayTemplate.findMany({
      where: { isActive: true },
    });

    const pool =
      dbTemplates.length > 0
        ? dbTemplates.map((t) => t.body)
        : DEFAULT_TEMPLATES.map((t) => t.body);

    const picked = pool[Math.floor(Math.random() * pool.length)];

    return picked
      .replaceAll('{name}', user.name)
      .replaceAll('{firstName}', firstName)
      .replaceAll('{department}', user.department ?? 'la compañía')
      .replaceAll('{position}', user.position ?? '');
  }

  private async resolveSystemAuthorId(): Promise<string> {
    if (envs.BIRTHDAY_SYSTEM_USER_ID) return envs.BIRTHDAY_SYSTEM_USER_ID;

    const rrhh = await this.prisma.user.findFirst({
      where: { role: 'RRHH', status: 'ACTIVE', isLeader: true },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!rrhh) {
      throw new Error(
        'No hay usuario ADMIN para usar como autor de posts de cumpleaños. Configura BIRTHDAY_SYSTEM_USER_ID',
      );
    }

    return rrhh.userId;
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfToday(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
