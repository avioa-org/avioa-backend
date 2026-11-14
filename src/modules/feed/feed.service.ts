import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ICurrentUser } from 'src/common/decorator/current-user.decorator';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedGateway } from './feed.gateway';
import { MappedAttachment, ReactionPayload } from './types/feed.types';
import { AttachmentInputDto, PresignAttachmentDto } from './dto/attachment.dto';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import { randomUUID } from 'crypto';

const AUTHOR_SELECT = {
  userId: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const;

const REACTION_SELECT = {
  select: {
    type: true,
    userId: true,
    user: { select: AUTHOR_SELECT },
  },
} as const;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedGateway: FeedGateway,
    private readonly storageService: StorageService,
  ) {}

  async findAll(query: FeedQueryDto, userId: string) {
    const { cursor, limit, type } = query;

    const where = {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    };

    const posts = await this.prisma.feedPost.findMany({
      where,
      take: limit + 1,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        attachments: true,
        _count: { select: { reactions: true } },
        reactions: REACTION_SELECT,
        comments: {
          where: { deletedAt: null, parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: AUTHOR_SELECT },
            // orderBy: { createdAt: 'asc' },
            replies: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: { author: { select: AUTHOR_SELECT } },
            },
            reactions: { select: { type: true, userId: true } },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = page.length > 0 ? page[page.length - 1].createdAt : null;

    return {
      posts: await Promise.all(page.map((p) => this.mapPost(p, userId))),
      hasMore,
      nextCursor,
    };
  }

  async findOne(feedPostId: string, userId: string) {
    const post = await this.prisma.feedPost.findFirst({
      where: { feedPostId, deletedAt: null },
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        attachments: true,
        _count: { select: { reactions: true } },
        reactions: REACTION_SELECT,
        comments: {
          where: { deletedAt: null, parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: AUTHOR_SELECT },
            replies: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: {
                author: { select: AUTHOR_SELECT },
                reactions: { select: { type: true, userId: true } },
              },
            },
          },
        },
      },
    });

    if (!post) throw new NotFoundException('Publicación no encontrada');
    return this.mapPost(post, userId);
  }

  async create(dto: CreatePostDto, user: ICurrentUser) {
    if (dto.type === 'RECOGNITION' && !dto.recognizedUserId) {
      throw new ForbiddenException('Debes indicar a quién reconoces');
    }

    this.assertOwnedKeys(dto.attachments, user.userId);

    const post = await this.prisma.feedPost.create({
      data: {
        authorId: user.userId,
        type: dto.type,
        content: dto.content,
        images: dto.images ?? [],
        recognizedUserId: dto.recognizedUserId ?? null,
        attachments: {
          create: (dto.attachments ?? []).map((a) => ({
            type: a.type,
            storageKey: a.storageKey,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            width: a.width ?? null,
            height: a.height ?? null,
          })),
        },
      },
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        attachments: true,
      },
    });

    const mapped = await this.mapPost(
      {
        ...post,
        _count: { reactions: 0 },
        reactions: [],
        comments: [],
      },
      user.userId,
    );

    this.feedGateway.emitNewPost(mapped, user.userId);

    return mapped;
  }

  async update(feedPostId: string, dto: UpdatePostDto, user: ICurrentUser) {
    await this.getOwnedPostOrThrow(feedPostId, user);
    this.assertOwnedKeys(dto.attachments, user.userId);

    const current = await this.prisma.feedAttachment.findMany({
      where: { postId: feedPostId },
      select: { feedAttachmentId: true, storageKey: true },
    });

    const newKeys = new Set((dto.attachments ?? []).map((a) => a.storageKey));
    const toDelete = current.filter((c) => !newKeys.has(c.storageKey));

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.attachments) {
        await tx.feedAttachment.deleteMany({ where: { postId: feedPostId } });
        await tx.feedAttachment.createMany({
          data: dto.attachments.map((a) => ({
            postId: feedPostId,
            type: a.type,
            storageKey: a.storageKey,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            width: a.width ?? null,
            height: a.height ?? null,
          })),
        });
      }

      return tx.feedPost.update({
        where: { feedPostId },
        data: {
          content: dto.content,
          // type: dto.type,
          recognizedUserId: dto.recognizedUserId,
        },
        include: {
          author: { select: AUTHOR_SELECT },
          recognizedUser: { select: AUTHOR_SELECT },
          _count: { select: { reactions: true } },
          reactions: REACTION_SELECT,
          attachments: true,
          comments: {
            where: { deletedAt: null, parentId: null },
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: AUTHOR_SELECT },
              replies: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                include: {
                  author: { select: AUTHOR_SELECT },
                  reactions: { select: { type: true, userId: true } },
                },
              },
            },
          },
        },
      });
    });

    // borrar huérfanos de storage (best-effort)
    await Promise.allSettled(
      toDelete.map((d) => this.storageService.deleteFile(d.storageKey)),
    );

    const mapped = await this.mapPost(updated, user.userId);
    this.feedGateway.emitPostUpdated(mapped);
    return mapped;
  }

  async remove(feedPostId: string, user: ICurrentUser) {
    await this.getOwnedPostOrThrow(feedPostId, user);

    const attachments = await this.prisma.feedAttachment.findMany({
      where: { postId: feedPostId },
      select: { storageKey: true },
    });

    await this.prisma.feedPost.update({
      where: { feedPostId },
      data: { deletedAt: new Date() },
    });

    await Promise.allSettled(
      attachments.map((a) => this.storageService.deleteFile(a.storageKey)),
    );

    this.feedGateway.emitPostDeleted(feedPostId);
    return { success: true };
  }

  async togglePin(feedPostId: string, user: ICurrentUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un administrador puede fijar publicaciones',
      );
    }
    const post = await this.prisma.feedPost.findFirst({
      where: { feedPostId, deletedAt: null },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const updated = await this.prisma.feedPost.update({
      where: { feedPostId },
      data: { pinned: !post.pinned },
    });

    this.feedGateway.emitPinToggled(feedPostId, updated.pinned);
    return updated;
  }

  // ============ REACCIONES ============
  async react(feedPostId: string, dto: CreateReactionDto, userId: string) {
    await this.ensurePostExists(feedPostId);

    await this.prisma.feedReaction.upsert({
      where: { postId_userId: { postId: feedPostId, userId } },
      create: { postId: feedPostId, userId, type: dto.type },
      update: { type: dto.type },
    });

    const payload = await this.buildReactionPayload(feedPostId, userId);
    this.feedGateway.emitReaction(feedPostId, payload);

    return { postId: feedPostId, ...payload, myReaction: dto.type };
  }

  async unreact(feedPostId: string, userId: string) {
    await this.prisma.feedReaction
      .delete({ where: { postId_userId: { postId: feedPostId, userId } } })
      .catch(() => null);

    const payload = await this.buildReactionPayload(feedPostId, userId);
    this.feedGateway.emitReaction(feedPostId, payload);

    return { postId: feedPostId, ...payload, myReaction: null };
  }

  private async buildReactionPayload(
    postId: string,
    currentUserId: string,
  ): Promise<ReactionPayload> {
    const reactions = await this.prisma.feedReaction.findMany({
      where: { postId },
      select: {
        type: true,
        userId: true,
        user: { select: AUTHOR_SELECT },
      },
    });

    const reactionsSummary: Record<string, number> = {};
    const reactionsByUser: Record<string, string> = {};

    for (const r of reactions) {
      reactionsSummary[r.type] = (reactionsSummary[r.type] ?? 0) + 1;
      reactionsByUser[r.userId] = r.type;
    }

    const recentReactors = reactions.slice(0, 5).map((r) => r.user);

    return {
      reactionsCount: reactions.length,
      reactionsSummary,
      recentReactors,
      reactionsByUser,
    };
  }

  // ============ COMENTARIOS (con replies) ============
  async addComment(postId: string, dto: CreateCommentDto, userId: string) {
    await this.ensurePostExists(postId);

    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.feedComment.findFirst({
        where: { feedCommentId: dto.parentId, postId, deletedAt: null },
        select: { feedCommentId: true, parentId: true },
      });
      if (!parent)
        throw new NotFoundException('Comentario padre no encontrado');

      parentId = parent.parentId ?? parent.feedCommentId;
    }

    const comment = await this.prisma.feedComment.create({
      data: { postId, authorId: userId, content: dto.content, parentId },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const mapped = this.mapComment({ ...comment, replies: [] }, userId);
    const commentsCount = await this.countComments(postId);

    this.feedGateway.emitNewComment(postId, mapped, commentsCount);
    return mapped;
  }

  async removeComment(commentId: string, user: ICurrentUser) {
    const comment = await this.prisma.feedComment.findFirst({
      where: { feedCommentId: commentId, deletedAt: null },
      select: {
        feedCommentId: true,
        postId: true,
        authorId: true,
        parentId: true,
      },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');

    if (comment.authorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este comentario',
      );
    }

    await this.prisma.feedComment.update({
      where: { feedCommentId: commentId },
      data: { deletedAt: new Date() },
    });

    const commentsCount = await this.countComments(comment.postId);

    this.feedGateway.emitCommentDeleted(
      comment.postId,
      commentId,
      comment.parentId,
      commentsCount,
    );

    return { success: true };
  }

  async presignAttachments(items: PresignAttachmentDto[], userId: string) {
    return Promise.all(
      items.map(async (f) => {
        const safeName = f.fileName.replace(/[^\w.\-]+/g, '_');
        const key = `feed/${userId}/${randomUUID()}-${safeName}`;
        const signed = await this.storageService.getPresignedUploadUrl(key);
        return {
          ...signed,
          type: f.type,
          fileName: f.fileName,
          mimeType: f.mimeType,
        };
      }),
    );
  }

  private async mapAttachments(
    attachments: any[],
  ): Promise<MappedAttachment[]> {
    if (!attachments.length) return [];

    const urls = await this.storageService.getPresignedDownloadUrls(
      attachments.map((a) => a.storageKey),
    );

    return Promise.all(
      attachments.map(async (a) => ({
        feedAttachmentId: a.feedAttachmentId,
        type: a.type,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        width: a.width ?? null,
        height: a.height ?? null,
        url: urls[a.storageKey],
      })),
    );
  }

  private assertOwnedKeys(
    attachments: AttachmentInputDto[] | undefined,
    userId: string,
  ) {
    for (const a of attachments ?? []) {
      if (!a.storageKey.startsWith(`feed/${userId}/`)) {
        throw new ForbiddenException('storageKey inválido');
      }
    }
  }

  private countComments(postId: string) {
    return this.prisma.feedComment.count({
      where: { postId, deletedAt: null },
    });
  }

  // ============ CUMPLEAÑOS ============
  async getBirthdaysThisMonth() {
    return this.prisma.$queryRaw<
      {
        userId: string;
        name: string;
        avatarUrl: string | null;
        birthDay: number;
        birthMonth: number;
      }[]
    >`
    SELECT
      user_id AS "userId",
      name,
      avatar_url AS "avatarUrl",
      EXTRACT(DAY FROM birth_date)::int AS "birthDay",
      EXTRACT(MONTH FROM birth_date)::int AS "birthMonth"
    FROM users
    WHERE birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND status = 'ACTIVE'
    ORDER BY EXTRACT(DAY FROM birth_date) ASC
  `;
  }

  async reactToComment(
    commentId: string,
    dto: CreateReactionDto,
    userId: string,
  ) {
    const comment = await this.prisma.feedComment.findFirst({
      where: { feedCommentId: commentId, deletedAt: null },
      select: { postId: true },
    });

    if (!comment) throw new NotFoundException('Comentario no encontrado');

    await this.prisma.feedCommentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, type: dto.type },
      update: { type: dto.type },
    });

    const payload = await this.buildCommentReactionPayload(commentId, userId);

    this.feedGateway.emitCommentReaction(comment.postId, commentId, payload);

    return { commentId, ...payload, myReaction: dto.type };
  }

  async unreactToComment(commentId: string, userId: string) {
    await this.prisma.feedCommentReaction
      .delete({ where: { commentId_userId: { commentId, userId } } })
      .catch(() => null);

    const payload = await this.buildCommentReactionPayload(commentId, userId);

    return { commentId, ...payload, myReaction: null };
  }

  private async buildCommentReactionPayload(
    commentId: string,
    currentUserId: string,
  ) {
    const reactions = await this.prisma.feedCommentReaction.findMany({
      where: { commentId },
      select: { type: true, userId: true },
    });

    const reactionsSummary: Record<string, number> = {};
    const reactionsByUser: Record<string, string> = {};

    for (const r of reactions) {
      reactionsSummary[r.type] = (reactionsSummary[r.type] ?? 0) + 1;
      reactionsByUser[r.userId] = r.type;
    }

    return {
      reactionsCount: reactions.length,
      reactionsSummary,
      reactionsByUser,
    };
  }

  private async ensurePostExists(feedPostId: string) {
    const post = await this.prisma.feedPost.findFirst({
      where: { feedPostId, deletedAt: null },
      select: { feedPostId: true },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');
  }

  private async getOwnedPostOrThrow(feedPostId: string, user: ICurrentUser) {
    const post = await this.prisma.feedPost.findFirst({
      where: { feedPostId, deletedAt: null },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (post.authorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tienes permiso para editar esta publicación',
      );
    }
    return post;
  }

  private mapComment(comment: any, currentUserId?: string) {
    const reactions = comment.reactions ?? [];

    const reactionsSummary = reactions.reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.type] = (acc[r.type] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      feedCommentId: comment.feedCommentId,
      content: comment.content,
      author: comment.author,
      parentId: comment.parentId ?? null,
      replies: (comment.replies ?? []).map((r: any) =>
        this.mapComment(r, currentUserId),
      ),
      createdAt: comment.createdAt,
      reactionsCount: reactions.length,
      reactionsSummary: reactionsSummary,
      myReaction: currentUserId
        ? (reactions.find((r: any) => r.userId === currentUserId)?.type ?? null)
        : null,
    };
  }

  private async mapPost(post: any, currentUserId: string) {
    const reactions = post.reactions ?? [];
    const reactionsSummary = reactions.reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.type] = (acc[r.type] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const myReaction =
      reactions.find((r: any) => r.userId === currentUserId)?.type ?? null;
    const recentReactors = reactions.slice(0, 5).map((r: any) => r.user);

    const comments = (post.comments ?? []).map((c: any) =>
      this.mapComment(c, currentUserId),
    );
    const commentsCount = comments.reduce(
      (sum: number, c: any) => sum + 1 + (c.replies?.length ?? 0),
      0,
    );

    const attachments = await this.mapAttachments(post.attachments ?? []);

    return {
      feedPostId: post.feedPostId,
      type: post.type,
      content: post.content,
      pinned: post.pinned,
      author: post.author,
      recognizedUser: post.recognizedUser ?? null,
      attachments, // { type, url, fileName, mimeType, sizeBytes, ... }
      reactionsCount: reactions.length,
      reactionsSummary,
      recentReactors,
      myReaction,
      comments,
      commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
