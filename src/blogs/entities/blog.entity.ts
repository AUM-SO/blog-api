import { ApiProperty } from '@nestjs/swagger';
import { BlogStatus } from '../../../generated/prisma/client';

export class BlogAuthorEntity {
  @ApiProperty({ example: 4 })
  id: number;

  @ApiProperty({ example: 'alicewriter' })
  username: string;
}

export class BlogTagEntity {
  @ApiProperty({ example: 'Next.js' })
  name: string;

  @ApiProperty({ example: 'next-js', description: 'Use as ?tag= when listing blogs.' })
  slug: string;
}

export class TagUsageEntity extends BlogTagEntity {
  @ApiProperty({ example: 4, description: 'Blogs with this tag that the caller can see.' })
  count: number;
}

export class TagListEntity {
  @ApiProperty({ type: [TagUsageEntity] })
  data: TagUsageEntity[];
}

export class BlogCountEntity {
  @ApiProperty({ example: 3, description: 'Number of comments on this blog.' })
  comments: number;

  @ApiProperty({
    example: 12,
    description:
      'Distinct readers who opened this blog. One row per user, and visits by the author are not counted.',
  })
  views: number;
}

/** List rows omit `content` — see BlogEntity for the full record. */
export class BlogListItemEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({
    example: 4,
    description: 'Id of the author. Only the author may update the blog.',
  })
  authorId: number;

  @ApiProperty({ example: 'Getting started with the Blog Management System' })
  title: string;

  @ApiProperty({
    nullable: true,
    maxLength: 300,
    example: 'A short summary shown under the title in listings.',
    description: 'Author-written summary; null means listings fall back to an excerpt cut from the body.',
  })
  description: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:13.229Z' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:13.229Z' })
  updatedAt: Date;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    example: '2026-08-10T09:00:00.000Z',
    description: 'Start of the display window; null means visible immediately.',
  })
  publishedFrom: Date | null;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    example: '2026-08-31T17:00:00.000Z',
    description: 'End of the display window; null means it never expires.',
  })
  publishedUntil: Date | null;

  @ApiProperty({ enum: BlogStatus, example: BlogStatus.PUBLISHED, description: 'DRAFT is visible to its author only.' })
  status: BlogStatus;

  @ApiProperty({ type: [BlogTagEntity] })
  tags: BlogTagEntity[];

  @ApiProperty({ type: BlogAuthorEntity })
  author: BlogAuthorEntity;

  @ApiProperty({ type: BlogCountEntity, name: '_count' })
  _count: BlogCountEntity;
}

export class BlogEntity extends BlogListItemEntity {
  @ApiProperty({ example: 'Full article body.' })
  content: string;
}

/**
 * Shown on the signed-out login screen, so it is deliberately the smallest
 * useful shape: no id (nothing to deep-link into), no body text.
 */
export class BlogHighlightEntity {
  @ApiProperty({ example: 'Getting started with the Blog Management System' })
  title: string;

  @ApiProperty({ example: 'alicewriter' })
  author: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:13.229Z' })
  createdAt: Date;

  @ApiProperty({
    nullable: true,
    example: 'https://example.supabase.co/storage/v1/object/public/…png',
  })
  coverUrl: string | null;
}

export class BlogHighlightsEntity {
  @ApiProperty({ type: [BlogHighlightEntity] })
  data: BlogHighlightEntity[];
}

/** Reader-facing shape: no authorId, no status, no scheduling fields. */
export class PublicBlogEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Getting started with the Blog Management System' })
  title: string;

  @ApiProperty({
    nullable: true,
    maxLength: 300,
    example: 'A short summary shown under the title in listings.',
    description: 'Author-written summary; null means listings fall back to an excerpt cut from the body.',
  })
  description: string | null;

  @ApiProperty({ example: 'The full article body.' })
  content: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:13.229Z' })
  createdAt: Date;

  @ApiProperty({ example: { username: 'alicewriter' } })
  author: { username: string };

  @ApiProperty({ type: [BlogTagEntity] })
  tags: BlogTagEntity[];

  @ApiProperty({ type: BlogCountEntity, name: '_count' })
  _count: BlogCountEntity;
}

export class PublicBlogListItemEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Getting started with the Blog Management System' })
  title: string;

  @ApiProperty({
    nullable: true,
    maxLength: 300,
    example: 'A short summary shown under the title in listings.',
    description: 'Author-written summary; null means listings fall back to an excerpt cut from the body.',
  })
  description: string | null;

  @ApiProperty({ example: 'First 200 characters of the body…' })
  excerpt: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:13.229Z' })
  createdAt: Date;

  @ApiProperty({ example: { username: 'alicewriter' } })
  author: { username: string };

  @ApiProperty({ type: [BlogTagEntity] })
  tags: BlogTagEntity[];

  @ApiProperty({ nullable: true, example: 'https://…/cover.png' })
  coverUrl: string | null;

  @ApiProperty({ type: BlogCountEntity, name: '_count' })
  _count: BlogCountEntity;
}

export class PublicPaginatedBlogsEntity {
  @ApiProperty({ type: [PublicBlogListItemEntity] })
  data: PublicBlogListItemEntity[];

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class PaginatedBlogsEntity {
  @ApiProperty({ type: [BlogListItemEntity] })
  data: BlogListItemEntity[];

  @ApiProperty({ example: 3, description: 'Total rows matching the search.' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
