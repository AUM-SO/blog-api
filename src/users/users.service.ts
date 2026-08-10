import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where =
      query.status === 'pending'
        ? { isActive: false }
        : query.status === 'active'
          ? { isActive: true }
          : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.publicSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicSelect(),
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Accepts the admin DTO or the narrower self-service one; the controller
  // decides which fields a caller is allowed to send.
  async update(id: number, dto: UpdateUserDto | UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.email || dto.username) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.username ? [{ username: dto.username }] : []),
          ],
        },
      });
      if (conflict) {
        throw new ConflictException(
          conflict.email === dto.email
            ? 'Email is already registered'
            : 'Username is already taken',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.publicSelect(),
    });

    // The old avatar object is orphaned once a new one lands; clean it up
    // after the swap so a failed update never leaves the profile without both.
    const replacesAvatar =
      'avatarPath' in dto &&
      dto.avatarPath &&
      existing.avatarPath &&
      existing.avatarPath !== dto.avatarPath;
    if (replacesAvatar) {
      await this.storageService.removeImages([existing.avatarPath!]);
    }

    return updated;
  }

  async activate(id: number) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: this.publicSelect(),
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  private publicSelect() {
    return {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
