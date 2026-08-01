import { Body, Controller, Get, Patch, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { ReviewsService, ReviewWriteInput } from './reviews.service.js';

@Controller('public/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('featured') featured?: string,
  ) {
    const parsedLimit = Number(limit || 10);
    return ok(
      await this.reviews.getPublicReviews(
        Number.isFinite(parsedLimit) ? parsedLimit : 10,
        featured === 'true',
      ),
    );
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('Super Admin', 'Administrador', 'Supervisor')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list() {
    return ok(await this.reviews.listAdmin());
  }

  @Post()
  async create(@Body() body: ReviewWriteInput) {
    return ok(await this.reviews.createManual(body));
  }

  @Patch(':reviewId')
  async update(
    @Param('reviewId') reviewId: string,
    @Body() body: ReviewWriteInput,
  ) {
    return ok(await this.reviews.update(reviewId, body));
  }
}
