import { ApiProperty } from '@nestjs/swagger';
import { BlogAuthorEntity } from '../../blogs/entities/blog.entity';

export class CommentEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'Clear walkthrough — thanks for writing it up.' })
  content: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T07:12:44.101Z' })
  createdAt: Date;

  @ApiProperty({ example: 2 })
  blogId: number;

  @ApiProperty({
    type: BlogAuthorEntity,
    description: 'The commenter. Note the field is `user`, not `author`.',
  })
  user: BlogAuthorEntity;
}
