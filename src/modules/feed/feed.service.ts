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
import { ReactionPayload } from './types/feed.types';

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
              include: { author: { select: AUTHOR_SELECT } },
            },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = page.length > 0 ? page[page.length - 1].createdAt : null;

    return {
      posts: page.map((p) => this.mapPost(p, userId)),
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
              include: { author: { select: AUTHOR_SELECT } },
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

    const post = await this.prisma.feedPost.create({
      data: {
        authorId: user.userId,
        type: dto.type,
        content: dto.content,
        images: dto.images ?? [],
        recognizedUserId: dto.recognizedUserId ?? null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
      },
    });

    const mapped = this.mapPost(
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

    const updated = await this.prisma.feedPost.update({
      where: { feedPostId },
      data: dto,
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
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
              include: { author: { select: AUTHOR_SELECT } },
            },
          },
        },
      },
    });

    const mapped = this.mapPost(updated, user.userId);
    this.feedGateway.emitPostUpdated(mapped);
    return mapped;
  }

  async remove(feedPostId: string, user: ICurrentUser) {
    await this.getOwnedPostOrThrow(feedPostId, user);
    await this.prisma.feedPost.update({
      where: { feedPostId },
      data: { deletedAt: new Date() },
    });
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

    const mapped = this.mapComment({ ...comment, replies: [] });
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
    ORDER BY EXTRACT(DAY FROM birth_date) ASC
  `;
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

  private mapComment(comment: any) {
    return {
      feedCommentId: comment.feedCommentId,
      content: comment.content,
      author: comment.author,
      parentId: comment.parentId ?? null,
      replies: (comment.replies ?? []).map((r: any) => this.mapComment(r)),
      createdAt: comment.createdAt,
    };
  }

  private mapPost(post: any, currentUserId: string) {
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

    const comments = (post.comments ?? []).map((c: any) => this.mapComment(c));
    const commentsCount = comments.reduce(
      (sum: number, c: any) => sum + 1 + (c.replies?.length ?? 0),
      0,
    );

    return {
      feedPostId: post.feedPostId,
      type: post.type,
      content: post.content,
      images: post.images ?? [],
      pinned: post.pinned,
      author: post.author,
      recognizedUser: post.recognizedUser ?? null,
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
