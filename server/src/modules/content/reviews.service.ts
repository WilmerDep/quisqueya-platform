import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewSource, ReviewStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service.js';

export interface ReviewWriteInput {
  authorName?: unknown;
  authorAvatarUrl?: unknown;
  rating?: unknown;
  reviewText?: unknown;
  language?: unknown;
  reviewUrl?: unknown;
  reviewedAt?: unknown;
  status?: unknown;
  featured?: unknown;
  sortOrder?: unknown;
  source?: unknown;
  externalId?: unknown;
  sourcePayload?: unknown;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicReviews(limit = 10, featuredOnly = false) {
    const take = Math.min(Math.max(limit, 1), 30);
    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.PUBLISHED,
      ...(featuredOnly ? { featured: true } : {}),
    };

    const [items, aggregate, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { reviewedAt: 'desc' }, { createdAt: 'desc' }],
        take,
      }),
      this.prisma.review.aggregate({
        where: { status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
      }),
      this.prisma.review.count({ where: { status: ReviewStatus.PUBLISHED } }),
    ]);

    return {
      summary: {
        rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
        reviewCount: total,
        source: 'google',
      },
      items: items.map(item => this.toPublicReview(item)),
    };
  }

  async listAdmin() {
    const items = await this.prisma.review.findMany({
      orderBy: [{ status: 'asc' }, { featured: 'desc' }, { sortOrder: 'asc' }, { reviewedAt: 'desc' }],
    });
    return items.map(item => this.toAdminReview(item));
  }

  async createManual(input: ReviewWriteInput) {
    const data = this.normalizeWriteInput(input, true);
    const created = await this.prisma.review.create({
      data: {
        id: randomUUID(),
        source: ReviewSource.MANUAL,
        authorName: data.authorName!,
        authorAvatarUrl: data.authorAvatarUrl,
        rating: data.rating!,
        reviewText: data.reviewText!,
        language: data.language,
        reviewUrl: data.reviewUrl,
        reviewedAt: data.reviewedAt,
        status: data.status ?? ReviewStatus.PENDING,
        featured: data.featured ?? false,
        sortOrder: data.sortOrder ?? 0,
        sourcePayload: this.jsonValue(input.sourcePayload),
      },
    });
    return this.toAdminReview(created);
  }

  async update(id: string, input: ReviewWriteInput) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reseña no encontrada.');

    const data = this.normalizeWriteInput(input, false);
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(typeof data.authorName === 'string' ? { authorName: data.authorName } : {}),
        ...(data.authorAvatarUrl !== undefined ? { authorAvatarUrl: data.authorAvatarUrl } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(typeof data.reviewText === 'string' ? { reviewText: data.reviewText } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.reviewUrl !== undefined ? { reviewUrl: data.reviewUrl } : {}),
        ...(data.reviewedAt !== undefined ? { reviewedAt: data.reviewedAt } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
    return this.toAdminReview(updated);
  }

  private normalizeWriteInput(input: ReviewWriteInput, required: boolean) {
    const authorName = this.optionalText(input.authorName);
    const reviewText = this.optionalText(input.reviewText);
    const rating = this.optionalInteger(input.rating);

    if (required && (!authorName || !reviewText || rating === undefined)) {
      throw new BadRequestException('Autor, puntuación y comentario son obligatorios.');
    }
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new BadRequestException('La puntuación debe estar entre 1 y 5.');
    }

    const statusValue = this.optionalText(input.status);
    const status = statusValue ? this.reviewStatus(statusValue) : undefined;
    const reviewedAt = input.reviewedAt === undefined ? undefined : this.optionalDate(input.reviewedAt);

    return {
      authorName,
      authorAvatarUrl: input.authorAvatarUrl === undefined ? undefined : this.optionalText(input.authorAvatarUrl),
      rating,
      reviewText,
      language: input.language === undefined ? undefined : this.optionalText(input.language),
      reviewUrl: input.reviewUrl === undefined ? undefined : this.optionalText(input.reviewUrl),
      reviewedAt,
      status,
      featured: typeof input.featured === 'boolean' ? input.featured : undefined,
      sortOrder: this.optionalInteger(input.sortOrder),
    };
  }

  private reviewStatus(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!Object.values(ReviewStatus).includes(normalized as ReviewStatus)) {
      throw new BadRequestException('Estado de reseña inválido.');
    }
    return normalized as ReviewStatus;
  }

  private optionalText(value: unknown) {
    if (value === null) return null;
    return typeof value === 'string' ? value.trim() || null : undefined;
  }

  private optionalInteger(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    if (!Number.isInteger(number)) throw new BadRequestException('Se esperaba un número entero.');
    return number;
  }

  private optionalDate(value: unknown) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' && !(value instanceof Date)) {
      throw new BadRequestException('Fecha de reseña inválida.');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Fecha de reseña inválida.');
    return date;
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value || typeof value !== 'object') return undefined;
    return value as Prisma.InputJsonValue;
  }

  private toPublicReview(item: {
    id: string;
    authorName: string;
    authorAvatarUrl: string | null;
    rating: number;
    reviewText: string;
    language: string | null;
    reviewUrl: string | null;
    reviewedAt: Date | null;
    source: ReviewSource;
    featured: boolean;
  }) {
    return {
      id: item.id,
      author: item.authorName,
      avatarUrl: item.authorAvatarUrl,
      rating: item.rating,
      quote: item.reviewText,
      language: item.language,
      reviewUrl: item.reviewUrl,
      publishedAt: item.reviewedAt?.toISOString() ?? null,
      source: item.source.toLowerCase(),
      featured: item.featured,
    };
  }

  private toAdminReview(item: {
    id: string;
    source: ReviewSource;
    externalId: string | null;
    authorName: string;
    authorAvatarUrl: string | null;
    rating: number;
    reviewText: string;
    language: string | null;
    reviewUrl: string | null;
    reviewedAt: Date | null;
    status: ReviewStatus;
    featured: boolean;
    sortOrder: number;
    syncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...item,
      source: item.source.toLowerCase(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      syncedAt: item.syncedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
