import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { DmcContentService } from './dmc-content.service.js';
import { PublicReviewsController, ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, PublicReviewsController, ReviewsController],
  providers: [ContentService, DmcContentService, ReviewsService],
  exports: [ContentService, DmcContentService, ReviewsService],
})
export class ContentModule {}
