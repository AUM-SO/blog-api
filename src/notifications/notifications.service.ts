import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    const [data, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        select: this.select(),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
    ]);

    return { data, unreadCount };
  }

  unreadCount(userId: number) {
    return this.prisma.notification
      .count({ where: { recipientId: userId, isRead: false } })
      .then((count) => ({ unreadCount: count }));
  }

  async markRead(id: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.recipientId !== userId) {
      throw new ForbiddenException('This notification does not belong to you');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: this.select(),
    });
  }

  async markAllRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  private select() {
    return {
      id: true,
      isRead: true,
      createdAt: true,
      comment: {
        select: {
          id: true,
          content: true,
          blogId: true,
          parentId: true,
          user: { select: { id: true, username: true } },
          blog: { select: { id: true, title: true } },
        },
      },
    } as const;
  }
}
