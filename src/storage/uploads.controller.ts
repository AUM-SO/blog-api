import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MAX_IMAGE_BYTES, StorageService } from './storage.service';

const MAX_FILES_PER_REQUEST = 10;

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  // Uploads are decoupled from blog creation so the editor can show previews
  // before the post exists. The returned {url, path} pairs are then sent back
  // with the blog payload.
  @Post('images')
  @ApiOperation({
    summary: 'Upload blog images',
    description:
      'Any signed-in user. Accepts up to 10 files of 4MB each (jpeg, png, webp, gif) ' +
      'and returns the stored url/path pairs to attach to a blog.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No files were uploaded');
    }

    const images = await Promise.all(
      files.map((file) => this.storageService.uploadImage(file)),
    );
    return { images };
  }

  // Separate from the blog route so avatars land in their own folder: mixing
  // them into blogs/ makes the bucket impossible to reason about later.
  @Post('avatar')
  @ApiOperation({
    summary: 'Upload a profile photo',
    description:
      'Any signed-in user. One file up to 4MB (jpeg, png, webp, gif). Returns the ' +
      'url/path pair to send to PATCH /users/me.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    return this.storageService.uploadImage(file, 'avatars');
  }
}
