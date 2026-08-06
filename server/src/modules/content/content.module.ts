import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { DmcContentService } from './dmc-content.service.js';
import { ExperienceEditorialController } from './experience-editorial.controller.js';
import { ExperienceEditorialService } from './experience-editorial.service.js';
import { PublicReviewsController, ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    ContentController,
    ExperienceEditorialController,
    PublicReviewsController,
    ReviewsController,
  ],
  providers: [ContentService, DmcContentService, ExperienceEditorialService, ReviewsService],
  exports: [ContentService, DmcContentService, ExperienceEditorialService, ReviewsService],
})
export class ContentModule {}
