import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Sent back by the client after POST /uploads/images. Only url and path are
// accepted — anything else about the file is derived server-side.
export class BlogImageDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  url: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  path: string;

  @ApiPropertyOptional({
    description: 'Marks this image as the cover. At most one may be true.',
  })
  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}
