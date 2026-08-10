import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  BlogEntity,
  BlogHighlightsEntity,
  PaginatedBlogsEntity,
  TagListEntity,
} from './entities/blog.entity';
import {
  ErrorResponseEntity,
  SuccessResponseEntity,
} from '../common/entities/api-response.entity';

@ApiTags('blogs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing or invalid access token.',
  type: ErrorResponseEntity,
})
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a blog' })
  @ApiCreatedResponse({
    description: 'The caller becomes the author.',
    type: BlogEntity,
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBlogDto) {
    return this.blogsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List blogs, newest first',
    description:
      'Paginated. `search` matches title or content, case-insensitively. ' +
      'List rows omit `content` — fetch a single blog for the full body. ' +
      'Only blogs inside their display window are returned, plus the caller’s ' +
      'own blogs; a Super Admin sees every blog.',
  })
  @ApiOkResponse({ type: PaginatedBlogsEntity })
  findAll(
    @Query() query: ListBlogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blogsService.findAll(query, { id: user.id, role: user.role });
  }

  // Also before ':id', same reason as highlights below.
  @Get('tags')
  @ApiOperation({
    summary: 'Tags in use, with how many blogs carry each',
    description:
      'Counted over the blogs the caller can actually see, so a tag used only ' +
      'by scheduled posts does not appear to everyone.',
  })
  @ApiOkResponse({ type: TagListEntity })
  tags(@CurrentUser() user: AuthenticatedUser) {
    return this.blogsService.findTags({ id: user.id, role: user.role });
  }

  // Declared before ':id' so ParseIntPipe never sees the word "highlights".
  @Public()
  @Get('highlights')
  @ApiOperation({
    summary: 'Public teaser list for the signed-out landing screen',
    description:
      'The only blog route that does not require a token. Returns titles, ' +
      'authors, dates and cover images for the newest blogs currently inside ' +
      'their display window — no ids and no body text, so the full post still ' +
      'requires signing in.',
  })
  @ApiOkResponse({ type: BlogHighlightsEntity })
  highlights() {
    return this.blogsService.findHighlights();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one blog with its full content',
    description:
      'A blog outside its display window answers 404 for everyone except its ' +
      'author and Super Admins — the schedule must not leak its existence.',
  })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: BlogEntity })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blogsService.findOne(id, { id: user.id, role: user.role });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a blog',
    description:
      'Author only. A Super Admin cannot edit someone else’s blog — they can only delete it.',
  })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: BlogEntity })
  @ApiForbiddenResponse({
    description: 'Caller is not the author.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBlogDto,
  ) {
    return this.blogsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a blog',
    description:
      'Allowed for the author or a Super Admin. Comments and notifications cascade.',
  })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: SuccessResponseEntity })
  @ApiForbiddenResponse({
    description: 'Caller is neither the author nor a Super Admin.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blogsService.remove(id, user.id, user.role);
  }
}
