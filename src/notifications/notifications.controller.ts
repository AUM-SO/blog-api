import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  MarkAllReadEntity,
  NotificationEntity,
  NotificationListEntity,
  UnreadCountEntity,
} from './entities/notification.entity';
import { ErrorResponseEntity } from '../common/entities/api-response.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing or invalid access token.',
  type: ErrorResponseEntity,
})
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the caller’s notifications, newest first',
    description:
      'Includes the unread count so the badge needs no second request.',
  })
  @ApiOkResponse({ type: NotificationListEntity })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findAll(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread count only — cheap enough to poll' })
  @ApiOkResponse({ type: UnreadCountEntity })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @ApiOkResponse({ type: MarkAllReadEntity })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', type: Number, example: 4 })
  @ApiOkResponse({ type: NotificationEntity })
  @ApiForbiddenResponse({
    description: 'The notification belongs to another user.',
    type: ErrorResponseEntity,
  })
  @ApiNotFoundResponse({ type: ErrorResponseEntity })
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }
}
