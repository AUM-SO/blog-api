import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { CommentsService } from '../comments/comments.service';
import { CommentEntity } from '../comments/entities/comment.entity';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import { Public } from '../common/decorators/public.decorator';
import {
  PublicBlogEntity,
  PublicPaginatedBlogsEntity,
  TagListEntity,
} from './entities/blog.entity';
import { ErrorResponseEntity } from '../common/entities/api-response.entity';

/**
 * The reader-facing surface: everything here answers without a token, so it is
 * kept in its own controller rather than mixed into /blogs. Nothing on these
 * routes reaches a draft, a scheduled post, an expired one, or any field that
 * identifies a user beyond the author's display name.
 */
@ApiTags('public')
@Public()
@Controller('public')
export class PublicBlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly commentsService: CommentsService,
  ) {}

  @Get('blogs')
  @ApiOperation({
    summary: 'Published blogs, for readers who are not signed in',
    description:
      'Same paging, search and tag filter as GET /blogs, but limited to posts ' +
      'that are published and inside their display window.',
  })
  @ApiOkResponse({ type: PublicPaginatedBlogsEntity })
  list(@Query() query: ListBlogsQueryDto) {
    return this.blogsService.findAllPublic(query);
  }

  @Get('blogs/:id')
  @ApiOperation({ summary: 'One published blog with its full content' })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: PublicBlogEntity })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.blogsService.findOnePublic(id);
  }

  @Get('blogs/:id/comments')
  @ApiOperation({
    summary: 'Comments on a published blog, oldest first',
    description:
      'Readable without a token; posting one still requires an account. ' +
      'A draft, scheduled or expired blog answers 404 like its detail route.',
  })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: [CommentEntity] })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  comments(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.findAllForPublicBlog(id);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Tags used by published blogs, with their counts' })
  @ApiOkResponse({ type: TagListEntity })
  tags() {
    return this.blogsService.findTags();
  }
}
