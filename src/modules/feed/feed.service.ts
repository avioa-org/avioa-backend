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

const AUTHOR_SELECT = {
  userId: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feedGateway: FeedGateway,
  ) {}

  async findAll(query: FeedQueryDto, userId: string) {
    const { cursor, limit, type } = query;
    // const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    };

    // const [posts, total] = await this.prisma.$transaction([
    //   this.prisma.feedPost.findMany({
    //     where,
    //     take: limit + 1,
    //     orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    //     include: {
    //       author: { select: AUTHOR_SELECT },
    //       recognizedUser: { select: AUTHOR_SELECT },
    //       _count: { select: { reactions: true, comments: true } },
    //       reactions: {
    //         where: { userId },
    //         select: { type: true },
    //       },
    //       comments: {
    //         take: 3,
    //         orderBy: { createdAt: 'desc' },
    //         where: { deletedAt: null },
    //         include: { author: { select: AUTHOR_SELECT } },
    //       },
    //     },
    //   }),
    //   this.prisma.feedPost.count({ where }),
    // ]);

    const posts = await this.prisma.feedPost.findMany({
      where,
      take: limit + 1,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        _count: { select: { reactions: true, comments: true } },
        reactions: {
          where: { userId },
          select: { type: true },
        },
        comments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          where: { deletedAt: null },
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = page.length > 0 ? page[page.length - 1].createdAt : null;

    // const mapped = posts.map((post) => this.mapPost(post));

    return {
      posts: page.map((p) => this.mapPost(p)),
      hasMore,
      nextCursor,
      // total,
      // page,
      // hasMore: skip + posts.length < total,
    };
  }

  async findOne(feedPostId: string, userId: string) {
    const post = await this.prisma.feedPost.findFirst({
      where: { feedPostId, deletedAt: null },
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        _count: { select: { reactions: true, comments: true } },
        reactions: { where: { userId }, select: { type: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          where: { deletedAt: null },
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    if (!post) throw new NotFoundException('Publicación no encontrada');

    return this.mapPost(post);
  }

  async create(dto: CreatePostDto, user: ICurrentUser) {
    if (dto.type === 'ANNOUNCEMENT' && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el lider y el admin pueden publicar anuncios',
      );
    }

    const post = await this.prisma.feedPost.create({
      data: {
        authorId: user.userId,
        type: dto.type,
        content: dto.content,
        images: dto.images ?? [],
        recognizedUserId: dto.recognizedUserId,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
      },
    });

    const mapped = this.mapPost({
      ...post,
      _count: { reactions: 0, comments: 0 },
      reactions: [],
      comments: [],
    });

    this.feedGateway.emitNewPost(mapped);

    return mapped;
  }

  async update(feedPostId: string, dto: UpdatePostDto, user: ICurrentUser) {
    const post = await this.getOwnedPostOrThrow(feedPostId, user);

    const updated = await this.prisma.feedPost.update({
      where: { feedPostId },
      data: dto,
      include: {
        author: { select: AUTHOR_SELECT },
        recognizedUser: { select: AUTHOR_SELECT },
        _count: { select: { reactions: true, comments: true } },
        reactions: { where: { userId: user.userId }, select: { type: true } },
        comments: {
          where: { deletedAt: null },
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    const mapped = this.mapPost(updated);

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

  async react(feedPostId: string, dto: CreateReactionDto, userId: string) {
    await this.ensurePostExists(feedPostId);

    const reaction = await this.prisma.feedReaction.upsert({
      where: { postId_userId: { postId: feedPostId, userId } },
      create: { postId: feedPostId, userId, type: dto.type },
      update: { type: dto.type },
    });

    const count = await this.prisma.feedReaction.count({
      where: { postId: feedPostId },
    });

    this.feedGateway.emitReaction(feedPostId, count);

    return reaction;
  }

  async unreact(postId: string, userId: string) {
    await this.prisma.feedReaction
      .delete({ where: { postId_userId: { postId, userId } } })
      .catch(() => null);

    const count = await this.prisma.feedReaction.count({ where: { postId } });

    this.feedGateway.emitReaction(postId, count);

    return { success: true };
  }

  async addComment(postId: string, dto: CreateCommentDto, userId: string) {
    await this.ensurePostExists(postId);

    const comment = await this.prisma.feedComment.create({
      data: { postId, authorId: userId, content: dto.content },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const count = await this.prisma.feedComment.count({
      where: { postId, deletedAt: null },
    });

    this.feedGateway.emitNewComment(postId, comment, count);

    return comment;
  }

  async removeComment(commentId: string, user: ICurrentUser) {
    const comment = await this.prisma.feedComment.findFirst({
      where: { feedCommentId: commentId, deletedAt: null },
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

    const count = await this.prisma.feedComment.count({
      where: { postId: comment.postId, deletedAt: null },
    });

    this.feedGateway.emitCommentDeleted(comment.postId, commentId, count);

    return { success: true };
  }

  // Cumpleaños
  async getBirthdaysThisMonth() {
    const users = await this.prisma.$queryRaw<
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
    AND EXTRACT(DAY FROM birth_date) >= EXTRACT(DAY FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  ORDER BY EXTRACT(DAY FROM birth_date)
  
  `;

    return users;
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

  private mapPost(post: any) {
    const myReaction = post.reactions?.[0]?.type ?? null;

    return {
      feedPostId: post.feedPostId,
      type: post.type,
      content: post.content,
      images: post.images,
      pinned: post.pinned,
      author: post.author,
      recognizedUser: post.recognizedUser ?? null,
      reactionsCount: post._count?.reactions ?? 0,
      commentsCount: post._count?.comments ?? 0,
      myReaction,
      comments: post.comments ?? [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
