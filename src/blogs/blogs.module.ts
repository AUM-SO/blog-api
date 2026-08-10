import { Module } from '@nestjs/common';
import { BlogsController } from './blogs.controller';
import { PublicBlogsController } from './public.controller';
import { BlogsService } from './blogs.service';
import { CommentsModule } from '../comments/comments.module';

@Module({
  // The reader-facing controller serves comment threads too, so it needs the
  // comments service without owning it.
  imports: [CommentsModule],
  controllers: [BlogsController, PublicBlogsController],
  providers: [BlogsService],
  exports: [BlogsService],
})
export class BlogsModule {}
