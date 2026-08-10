import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export interface StoredImage {
  url: string;
  path: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private client?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.bucket = configService.get<string>('SUPABASE_BUCKET') ?? 'blog-images';
    if (!this.isConfigured()) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — image uploads ' +
          'will fail, but the rest of the API works normally.',
      );
    }
  }

  private isConfigured() {
    return (
      !!this.configService.get<string>('SUPABASE_URL') &&
      !!this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    );
  }

  // Built on first use rather than in the constructor: missing storage
  // credentials must not stop the whole API from booting, they should only
  // fail the requests that actually need storage.
  private getClient(): SupabaseClient {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    // The service role key bypasses row level security, so it must never reach
    // the browser — every upload goes through this API, never direct-to-Supabase.
    this.client ??= createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );
    return this.client;
  }

  async uploadImage(
    file: Express.Multer.File,
    // Kept separate per kind of upload so a bucket listing stays readable and
    // a lifecycle rule can target one without touching the other.
    folder: 'blogs' | 'avatars' = 'blogs',
  ): Promise<StoredImage> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Each image must be 5MB or smaller');
    }

    // Random name: the original filename is attacker-controlled and could
    // collide or contain path separators.
    const path = `${folder}/${randomUUID()}${extname(file.originalname).toLowerCase()}`;

    const { error } = await this.getClient().storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new InternalServerErrorException('Could not store the image');
    }

    const { data } = this.getClient().storage.from(this.bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  // Best-effort: a blog delete should not fail because the object was already
  // gone from the bucket, so failures are logged rather than thrown.
  async removeImages(paths: string[]) {
    if (paths.length === 0 || !this.isConfigured()) return;

    const { error } = await this.getClient().storage
      .from(this.bucket)
      .remove(paths);

    if (error) {
      this.logger.warn(`Could not remove ${paths.length} object(s): ${error.message}`);
    }
  }
}
