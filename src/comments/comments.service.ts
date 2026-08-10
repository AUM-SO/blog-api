import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlogStatus } from '../../generated/prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(blogId: number, userId: number, dto: CreateCommentDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    // Recipients of the notification: the blog author always, plus the author
    // of the comment being replied to. Never the person doing the writing.
    const recipientIds = new Set<number>();
    if (blog.authorId !== userId) recipientIds.add(blog.authorId);

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, blogId: true, parentId: true, userId: true },
      });

      if (!parent || parent.blogId !== blogId) {
        throw new NotFoundException('Parent comment not found on this blog');
      }
      // Threads stay one level deep — replying to a reply attaches to the same
      // top-level comment rather than nesting further.
      if (parent.parentId) {
        throw new BadRequestException(
          'Replies can only be added to a top-level comment',
        );
      }
      if (parent.userId !== userId) recipientIds.add(parent.userId);
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        blogId,
        userId,
        parentId: dto.parentId ?? null,
      },
      select: this.select(),
    });

    if (recipientIds.size > 0) {
      await this.prisma.notification.createMany({
        data: [...recipientIds].map((recipientId) => ({
          recipientId,
          commentId: comment.id,
        })),
      });
    }

    return comment;
  }

  async findAllForBlog(blogId: number) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return this.listThreads(blogId);
  }

  // The reader-facing variant: a thread is only readable without a token when
  // the blog itself is. Without this gate the comment list would answer for a
  // draft or a scheduled post and confirm that a hidden id exists.
  async findAllForPublicBlog(blogId: number) {
    const now = new Date();
    const blog = await this.prisma.blog.findFirst({
      where: {
        id: blogId,
        status: BlogStatus.PUBLISHED,
        OR: [{ publishedFrom: null }, { publishedFrom: { lte: now } }],
        AND: [
          { OR: [{ publishedUntil: null }, { publishedUntil: { gte: now } }] },
        ],
      },
      select: { id: true },
    });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return this.listThreads(blogId);
  }

  private listThreads(blogId: number) {
    // Only top-level rows are fetched; their replies ride along nested, so the
    // client renders the thread without grouping the list itself.
    return this.prisma.comment.findMany({
      where: { blogId, parentId: null },
      select: {
        ...this.select(),
        replies: {
          select: this.select(),
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private select() {
    return {
      id: true,
      content: true,
      createdAt: true,
      blogId: true,
      parentId: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
    } as const;
  }
}
