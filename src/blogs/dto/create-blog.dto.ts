import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlogImageDto } from './blog-image.dto';
import { BlogStatus } from '../../../generated/prisma/client';

export const MAX_IMAGES_PER_BLOG = 10;
export const MAX_TAGS_PER_BLOG = 5;
// Matches the VarChar(30) on both Tag.name and Tag.slug.
export const TAG_MAX_LENGTH = 30;
// Long enough for two lines under a card title, short enough to stay a summary.
export const DESCRIPTION_MAX_LENGTH = 300;

export class CreateBlogDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    maxLength: DESCRIPTION_MAX_LENGTH,
    nullable: true,
    description:
      'Short summary shown under the title in listings. Send null to clear it; ' +
      'omit it and listings fall back to an excerpt cut from the body.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiProperty({
    description:
      'HTML from the editor. Sanitised server-side before it is stored — see BlogsService.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    enum: BlogStatus,
    default: BlogStatus.PUBLISHED,
    description:
      'DRAFT keeps the blog private to its author and ignores the display ' +
      'window. Switch to PUBLISHED when it should go live.',
  })
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_TAGS_PER_BLOG,
    example: ['Next.js', 'Prisma'],
    description:
      'Tag names as typed. Matched case-insensitively against existing tags ' +
      'and created on demand. Sending the field replaces the whole set.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_BLOG)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description:
      'Start of the display window (ISO 8601). Omit or send null to publish immediately.',
    example: '2026-08-10T09:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  publishedFrom?: string | null;

  @ApiPropertyOptional({
    description:
      'End of the display window (ISO 8601). Omit or send null to never expire. Must be after publishedFrom.',
    example: '2026-08-31T17:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  publishedUntil?: string | null;

  @ApiPropertyOptional({
    type: [BlogImageDto],
    description:
      'Images already uploaded via POST /uploads/images, in display order. ' +
      'Mark one with isCover to choose the cover; otherwise the first is used.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES_PER_BLOG)
  @ValidateNested({ each: true })
  @Type(() => BlogImageDto)
  images?: BlogImageDto[];
}
