import { ApiProperty } from '@nestjs/swagger';
import { BlogAuthorEntity } from '../../blogs/entities/blog.entity';

export class NotificationBlogEntity {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Getting started with the Blog Management System' })
  title: string;
}

export class NotificationCommentEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'Clear walkthrough — thanks for writing it up.' })
  content: string;

  @ApiProperty({ example: 2 })
  blogId: number;

  @ApiProperty({
    type: BlogAuthorEntity,
    description: 'Who wrote the comment.',
  })
  user: BlogAuthorEntity;

  @ApiProperty({ type: NotificationBlogEntity })
  blog: NotificationBlogEntity;
}

export class NotificationEntity {
  @ApiProperty({ example: 4 })
  id: number;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T07:12:44.180Z' })
  createdAt: Date;

  @ApiProperty({ type: NotificationCommentEntity })
  comment: NotificationCommentEntity;
}

export class NotificationListEntity {
  @ApiProperty({ type: [NotificationEntity] })
  data: NotificationEntity[];

  @ApiProperty({
    example: 2,
    description: 'Unread notifications for the caller.',
  })
  unreadCount: number;
}

export class UnreadCountEntity {
  @ApiProperty({ example: 2 })
  unreadCount: number;
}

export class MarkAllReadEntity {
  @ApiProperty({
    example: 2,
    description: 'How many notifications were flipped to read.',
  })
  updated: number;
}
