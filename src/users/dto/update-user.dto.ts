import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, Length } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 4, maxLength: 20 })
  @IsOptional()
  @Length(4, 20)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
