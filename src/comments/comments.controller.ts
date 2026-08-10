import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CommentEntity } from './entities/comment.entity';
import { ErrorResponseEntity } from '../common/entities/api-response.entity';

@ApiTags('comments')
@ApiBearerAuth()
@ApiParam({ name: 'blogId', type: Number, example: 2 })
@ApiUnauthorizedResponse({
  description: 'Missing or invalid access token.',
  type: ErrorResponseEntity,
})
@ApiNotFoundResponse({
  description: 'Blog not found.',
  type: ErrorResponseEntity,
})
@Controller('blogs/:blogId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Comment on a blog',
    description:
      'Notifies the blog author, unless the author is the one commenting.',
  })
  @ApiCreatedResponse({ type: CommentEntity })
  create(
    @Param('blogId', ParseIntPipe) blogId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(blogId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List a blog’s comments, oldest first' })
  @ApiOkResponse({ type: [CommentEntity] })
  findAll(@Param('blogId', ParseIntPipe) blogId: number) {
    return this.commentsService.findAllForBlog(blogId);
  }
}
