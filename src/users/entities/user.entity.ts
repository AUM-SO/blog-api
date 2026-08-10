import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';

/** A user as returned by the API — never includes the password hash. */
export class UserEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'alicewriter', minLength: 4, maxLength: 20 })
  username: string;

  @ApiProperty({ example: 'alice@demo.local', format: 'email' })
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.GENERAL_USER })
  role: Role;

  @ApiProperty({
    example: true,
    description:
      'False until a Super Admin activates the account. Inactive users cannot log in.',
  })
  isActive: boolean;

  @ApiProperty({
    example: 'https://xyz.supabase.co/storage/v1/object/public/blog-images/avatars/abc.webp',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:12.609Z' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time', example: '2026-08-09T06:54:12.609Z' })
  updatedAt: Date;
}

export class PaginatedUsersEntity {
  @ApiProperty({ type: [UserEntity] })
  data: UserEntity[];

  @ApiProperty({ example: 5, description: 'Total rows matching the filter.' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
