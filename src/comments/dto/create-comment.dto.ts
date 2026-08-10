import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description:
      'Id of the top-level comment being replied to. Omit for a new thread; ' +
      'passing the id of a reply is rejected because threads are one level deep.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;
}
