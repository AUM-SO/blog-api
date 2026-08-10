import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUrl, Length } from 'class-validator';

// Deliberately narrower than UpdateUserDto: role and activation stay out of
// reach so a general user cannot promote or activate themselves.
export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 4, maxLength: 20 })
  @IsOptional()
  @Length(4, 20, { message: 'Username must be between 4 and 20 characters' })
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  // Populated from the {url, path} pair returned by POST /uploads/images —
  // the client uploads the file first, then sends the pair here.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Length(1, 500)
  avatarPath?: string;
}
