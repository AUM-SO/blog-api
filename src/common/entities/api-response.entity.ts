import { ApiProperty } from '@nestjs/swagger';

/** Shape returned by endpoints that only confirm an action succeeded. */
export class SuccessResponseEntity {
  @ApiProperty({ example: true })
  success: boolean;
}

/** Nest's default error body. ValidationPipe returns `message` as an array. */
export class ErrorResponseEntity {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    description:
      'A single message, or one entry per failed validation rule when the request body is invalid.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Blog not found',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request', required: false })
  error?: string;
}
