import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { BlogImageDto } from './dto/blog-image.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import { TAG_MAX_LENGTH } from './dto/create-blog.dto';
import { BlogStatus, Role } from '../../generated/prisma/client';
import { htmlToPlainText, sanitizeBlogContent } from './content-sanitizer';

const EXCERPT_LENGTH = 200;
const HIGHLIGHT_COUNT = 6;

@Injectable()
export class BlogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Exactly one cover, even when the client marks none or several: the flagged
  // image wins, otherwise the first one does.
  private toImageRows(images: BlogImageDto[] | undefined) {
    if (!images?.length) return [];

    const coverIndex = Math.max(
      0,
      images.findIndex((image) => image.isCover),
    );

    return images.map((image, index) => ({
      url: image.url,
      path: image.path,
      position: index,
      isCover: index === coverIndex,
    }));
  }

  // "Next.js 16!" -> "next-js-16". Two authors typing the same tag with
  // different casing or punctuation must land on one row, so the slug is the
  // identity and the first spelling seen becomes the display name.
  static toSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9฀-๿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, TAG_MAX_LENGTH);
  }

  private toTagConnections(names: string[]) {
    const bySlug = new Map<string, string>();

    for (const name of names) {
      const slug = BlogsService.toSlug(name);
      if (!slug) continue;
      // First spelling wins; a repeat in the same payload is not an error.
      if (!bySlug.has(slug)) bySlug.set(slug, name.trim());
    }

    return [...bySlug].map(([slug, name]) => ({
      where: { slug },
      create: { slug, name },
    }));
  }

  // The author's own summary wins; otherwise the teaser is cut from the body's
  // text, never its markup, so a post that opens with a heading does not show
  // up in the listing as raw tags.
  private toExcerpt(description: string | null | undefined, content: string) {
    if (description?.trim()) return description.trim();

    const text = htmlToPlainText(content);
    return text.length > EXCERPT_LENGTH
      ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`
      : text;
  }

  // null clears a bound, undefined leaves it untouched — the two cases have to
  // stay distinct so a PATCH can remove a schedule without removing the other end.
  private toDate(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value === null ? null : new Date(value);
  }

  private assertWindowOrder(from: Date | null, until: Date | null) {
    if (from && until && until.getTime() <= from.getTime()) {
      throw new BadRequestException(
        'publishedUntil must be after publishedFrom',
      );
    }
  }

  // A blog is public only inside its window. The author always sees their own
  // work (scheduled or expired) and a Super Admin sees everything, otherwise
  // moderation would be blind to posts that are not currently on display.
  private canBypassWindow(
    blog: { authorId: number },
    viewer?: { id: number; role: string },
  ) {
    if (!viewer) return false;
    return viewer.id === blog.authorId || viewer.role === Role.SUPER_ADMIN;
  }

  // Drafts are stricter than scheduled posts on purpose: a schedule says "this
  // is finished, show it later", so a Super Admin can moderate it in advance.
  // A draft says "this is not finished", and nobody but the author sees it.
  private visibilityWhere(viewer?: { id: number; role: string }) {
    const own = viewer ? { authorId: viewer.id } : null;

    if (viewer?.role === Role.SUPER_ADMIN) {
      return { OR: [{ status: BlogStatus.PUBLISHED }, own!] };
    }

    const now = new Date();
    const live = {
      AND: [
        { status: BlogStatus.PUBLISHED },
        { OR: [{ publishedFrom: null }, { publishedFrom: { lte: now } }] },
        { OR: [{ publishedUntil: null }, { publishedUntil: { gte: now } }] },
      ],
    };

    return own ? { OR: [live, own] } : live;
  }

  async create(authorId: number, dto: CreateBlogDto) {
    const publishedFrom = this.toDate(dto.publishedFrom) ?? null;
    const publishedUntil = this.toDate(dto.publishedUntil) ?? null;
    this.assertWindowOrder(publishedFrom, publishedUntil);

    const blog = await this.prisma.blog.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        content: sanitizeBlogContent(dto.content),
        authorId,
        status: dto.status ?? BlogStatus.PUBLISHED,
        publishedFrom,
        publishedUntil,
        images: { create: this.toImageRows(dto.images) },
        tags: { connectOrCreate: this.toTagConnections(dto.tags ?? []) },
      },
      select: this.detailSelect(),
    });
    return blog;
  }

  async findAll(query: ListBlogsQueryDto, viewer?: { id: number; role: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { content: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const tagFilter = query.tag
      ? { tags: { some: { slug: BlogsService.toSlug(query.tag) } } }
      : {};

    // The status filter narrows what is already visible; it never widens it, so
    // ?status=DRAFT still only reaches the caller's own drafts.
    const statusFilter = query.status ? { status: query.status } : {};

    const where = {
      AND: [search, tagFilter, statusFilter, this.visibilityWhere(viewer)],
    };

    const [blogs, total] = await Promise.all([
      this.prisma.blog.findMany({
        where,
        select: this.listSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({ where }),
    ]);

    // The list only needs a teaser and the cover, so the full body never
    // crosses the wire for a page of ten posts.
    const data = blogs.map(({ content, images, ...blog }) => ({
      ...blog,
      excerpt: this.toExcerpt(blog.description, content),
      coverImage: images[0] ?? null,
    }));

    return { data, total, page, limit };
  }

  // Unauthenticated callers reach this one, so it selects field by field
  // instead of reusing listSelect(): no id, no body, nothing that would let a
  // stranger read or address a post without signing in.
  async findHighlights() {
    const blogs = await this.prisma.blog.findMany({
      where: this.visibilityWhere(),
      select: {
        title: true,
        createdAt: true,
        author: { select: { username: true, avatarUrl: true } },
        images: {
          where: { isCover: true },
          select: { url: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: HIGHLIGHT_COUNT,
    });

    return {
      data: blogs.map((blog) => ({
        title: blog.title,
        author: blog.author.username,
        createdAt: blog.createdAt,
        coverUrl: blog.images[0]?.url ?? null,
      })),
    };
  }

  // Field-by-field selects for the signed-out reader, deliberately not reusing
  // listSelect()/detailSelect(): those are shared with authenticated routes, and
  // a field added there later must not silently become public.
  private publicListSelect() {
    return {
      id: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
      author: { select: { username: true, avatarUrl: true } },
      tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
      images: { where: { isCover: true }, select: { url: true }, take: 1 },
      _count: { select: { comments: true, views: true } },
    } as const;
  }

  async findAllPublic(query: ListBlogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const search = query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' as const } },
            { content: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const tagFilter = query.tag
      ? { tags: { some: { slug: BlogsService.toSlug(query.tag) } } }
      : {};

    // No viewer: visibilityWhere() then means published and inside its window,
    // which is exactly the reader-facing rule. `query.status` is ignored here so
    // ?status=DRAFT cannot be used to probe for unpublished posts.
    const where = { AND: [search, tagFilter, this.visibilityWhere()] };

    const [blogs, total] = await Promise.all([
      this.prisma.blog.findMany({
        where,
        select: this.publicListSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({ where }),
    ]);

    const data = blogs.map(({ content, images, ...blog }) => ({
      ...blog,
      excerpt: this.toExcerpt(blog.description, content),
      coverUrl: images[0]?.url ?? null,
    }));

    return { data, total, page, limit };
  }

  async findOnePublic(id: number) {
    const blog = await this.prisma.blog.findFirst({
      // The visibility rule is part of the lookup, so an unpublished id is a
      // miss rather than a row that then has to be filtered out.
      where: { AND: [{ id }, this.visibilityWhere()] },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        createdAt: true,
        author: { select: { username: true, avatarUrl: true } },
        tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
        images: {
          select: { url: true, isCover: true },
          orderBy: { position: 'asc' },
        },
        _count: { select: { comments: true, views: true } },
      },
    });

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    return blog;
  }

  // Tags that still have at least one blog behind them. Counting every blog
  // (not only the ones this caller can see) would leak the existence of
  // scheduled posts, so the count is taken over the visible set.
  async findTags(viewer?: { id: number; role: string }) {
    const tags = await this.prisma.tag.findMany({
      where: { blogs: { some: this.visibilityWhere(viewer) } },
      select: {
        name: true,
        slug: true,
        _count: { select: { blogs: { where: this.visibilityWhere(viewer) } } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: tags.map((tag) => ({
        name: tag.name,
        slug: tag.slug,
        count: tag._count.blogs,
      })),
    };
  }

  async findOne(id: number, viewer?: { id: number; role: string }) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      select: this.detailSelect(),
    });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    // 404 rather than 403: a blog outside its window should look like it does
    // not exist, otherwise the schedule leaks the fact that it is there. The
    // same applies to a draft, which only its author may open at all.
    if (blog.status === BlogStatus.DRAFT) {
      if (viewer?.id !== blog.authorId) {
        throw new NotFoundException('Blog not found');
      }
      return blog;
    }

    const now = new Date();
    const live =
      (!blog.publishedFrom || blog.publishedFrom <= now) &&
      (!blog.publishedUntil || blog.publishedUntil >= now);

    if (!live && !this.canBypassWindow(blog, viewer)) {
      throw new NotFoundException('Blog not found');
    }

    await this.recordView(blog.id, blog.authorId, viewer);
    return blog;
  }

  // Authors do not inflate their own numbers, and the write never fails the
  // read: a view is a side effect of showing the page, not part of showing it.
  private async recordView(
    blogId: number,
    authorId: number,
    viewer?: { id: number; role: string },
  ) {
    if (!viewer || viewer.id === authorId) return;

    try {
      await this.prisma.blogView.upsert({
        where: { blogId_userId: { blogId, userId: viewer.id } },
        create: { blogId, userId: viewer.id },
        update: { viewedAt: new Date() },
      });
    } catch {
      // Losing a view count is not worth failing the request over.
    }
  }

  async update(id: number, userId: number, dto: UpdateBlogDto) {
    const blog = await this.getOwned(id);
    if (blog.authorId !== userId) {
      throw new ForbiddenException('Only the author can update this blog');
    }

    const { images, tags, publishedFrom, publishedUntil, content, ...fields } = dto;

    const nextFrom = this.toDate(publishedFrom);
    const nextUntil = this.toDate(publishedUntil);
    // Validate the window that will exist after the patch, not just the parts
    // the client happened to send.
    this.assertWindowOrder(
      nextFrom === undefined ? blog.publishedFrom : nextFrom,
      nextUntil === undefined ? blog.publishedUntil : nextUntil,
    );

    // images is a full replacement, so anything the client dropped from the
    // list is deleted from the bucket too — but only after the row update
    // succeeds, so a failed write never orphans live images.
    const removedPaths: string[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (images) {
        const existing = await tx.blogImage.findMany({
          where: { blogId: id },
          select: { path: true },
        });
        const keptPaths = new Set(images.map((image) => image.path));
        removedPaths.push(
          ...existing
            .map((image) => image.path)
            .filter((path) => !keptPaths.has(path)),
        );

        await tx.blogImage.deleteMany({ where: { blogId: id } });
        await tx.blogImage.createMany({
          data: this.toImageRows(images).map((row) => ({ ...row, blogId: id })),
        });
      }

      return tx.blog.update({
        where: { id },
        data: {
          ...fields,
          // Same sanitising as on create: the stored body must already be safe,
          // whichever route wrote it.
          ...(content === undefined ? {} : { content: sanitizeBlogContent(content) }),
          publishedFrom: nextFrom,
          publishedUntil: nextUntil,
          // Like images, the tag list is a full replacement: `set: []` drops
          // the old links first so removing a tag actually removes it.
          ...(tags
            ? {
                tags: {
                  set: [],
                  connectOrCreate: this.toTagConnections(tags),
                },
              }
            : {}),
        },
        select: this.detailSelect(),
      });
    });

    await this.storage.removeImages(removedPaths);
    return updated;
  }

  async remove(id: number, userId: number, role: string) {
    const blog = await this.getOwned(id);
    if (blog.authorId !== userId && role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only the author or a Super Admin can delete this blog',
      );
    }

    const images = await this.prisma.blogImage.findMany({
      where: { blogId: id },
      select: { path: true },
    });

    await this.prisma.blog.delete({ where: { id } });
    await this.storage.removeImages(images.map((image) => image.path));

    return { success: true };
  }

  private async getOwned(id: number) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    return blog;
  }

  private listSelect() {
    return {
      id: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      publishedFrom: true,
      publishedUntil: true,
      authorId: true,
      author: { select: { id: true, username: true, avatarUrl: true } },
      images: {
        where: { isCover: true },
        select: { id: true, url: true },
        take: 1,
      },
      tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
      _count: { select: { comments: true, views: true } },
    } as const;
  }

  private detailSelect() {
    return {
      id: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      publishedFrom: true,
      publishedUntil: true,
      authorId: true,
      author: { select: { id: true, username: true, avatarUrl: true } },
      images: {
        select: { id: true, url: true, path: true, isCover: true },
        orderBy: { position: 'asc' },
      },
      tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
      _count: { select: { comments: true, views: true } },
    } as const;
  }
}
