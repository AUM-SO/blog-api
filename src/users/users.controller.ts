import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '../../generated/prisma/client';
import { PaginatedUsersEntity, UserEntity } from './entities/user.entity';
import {
  ErrorResponseEntity,
  SuccessResponseEntity,
} from '../common/entities/api-response.entity';

// @Roles is applied per route rather than to the whole class: the /me routes
// are for any signed-in user, everything else is Super Admin only.
@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing or invalid access token.',
  type: ErrorResponseEntity,
})
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Declared before ':id' so "me" is never parsed as a numeric id.
  @Get('me')
  @ApiOperation({
    summary: 'Get the signed-in account',
    description: 'Available to any authenticated user, whatever their role.',
  })
  @ApiOkResponse({ type: UserEntity })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update your own username or email',
    description:
      'Only those two fields are accepted — `role` and `isActive` are rejected with 400, ' +
      'so an account cannot promote itself.',
  })
  @ApiOkResponse({ type: UserEntity })
  @ApiConflictResponse({
    description: 'Username or email already taken.',
    type: ErrorResponseEntity,
  })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.update(user.id, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ApiOperation({
    summary: 'List users, newest first (Super Admin)',
    description:
      'Filter with `status=pending` to find accounts awaiting activation.',
  })
  @ApiOkResponse({ type: PaginatedUsersEntity })
  @ApiForbiddenResponse({
    description: 'Super Admin only.',
    type: ErrorResponseEntity,
  })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get one user (Super Admin)' })
  @ApiParam({ name: 'id', type: Number, example: 4 })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({
    description: 'Super Admin only.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update any user (Super Admin)',
    description:
      'Unlike `PATCH /users/me`, this may change `role` and `isActive`.',
  })
  @ApiParam({ name: 'id', type: Number, example: 4 })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({
    description: 'Super Admin only.',
    type: ErrorResponseEntity,
  })
  @ApiConflictResponse({
    description: 'Username or email already taken.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activate a pending account (Super Admin)',
    description:
      'Registration leaves accounts inactive; this is what lets them log in.',
  })
  @ApiParam({ name: 'id', type: Number, example: 6 })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({
    description: 'Super Admin only.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activate(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user (Super Admin)',
    description: 'Their blogs, comments and notifications cascade.',
  })
  @ApiParam({ name: 'id', type: Number, example: 6 })
  @ApiOkResponse({ type: SuccessResponseEntity })
  @ApiForbiddenResponse({
    description: 'Super Admin only.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
