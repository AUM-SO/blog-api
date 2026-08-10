import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../users/entities/user.entity';

/** Returned by login and refresh: the account plus a fresh token pair. */
export class AuthSessionEntity {
  @ApiProperty({ type: UserEntity })
  user: UserEntity;

  @ApiProperty({
    description: 'Send as `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Single use. Refreshing revokes it and returns a new one; reusing a revoked token fails.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}
