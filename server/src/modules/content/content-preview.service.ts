import { Injectable } from '@nestjs/common';
import { ContentSourceProvider, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';

@Injectable()
export class ContentPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  private jsonArray<T>(value: Prisma.JsonValue | null): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
    return value as Record<string, unknown>;
  }

  private toNumericSourceId(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private mapMedia(row: {
    id: string;
    sourceId: string | null;
    sourceUrl: string | null;
    publicUrl: string;
    altText: string | null;
    width: number | null;
    height: number | null;
    mimeType: string | null;
  }) {
    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      sourceUrl: row.sourceUrl ?? undefined,
      url: row.publicUrl,
      alt: row.altText ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      mimeType: row.mimeType ?? undefined,
    };
  }

  async getExperience(slug: string) {
    const row = await this.prisma.experience.findUnique({ where: { slug } });
    if (!row) return null;

    const featured = row.featuredMediaId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: row.featuredMediaId },
          select: {
            id: true,
            sourceId: true,
            sourceUrl: true,
            publicUrl: true,
            altText: true,
            width: true,
            height: true,
            mimeType: true,
          },
        })
      : null;

    const galleryMediaSourceIds = this.jsonArray<number>(row.galleryMediaSourceIds)
      .map(Number)
      .filter(Number.isFinite);

    const galleryRows = galleryMediaSourceIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: {
            sourceProvider: ContentSourceProvider.WORDPRESS,
            sourceId: { in: galleryMediaSourceIds.map(String) },
          },
          select: {
            id: true,
            sourceId: true,
            sourceUrl: true,
            publicUrl: true,
            altText: true,
            width: true,
            height: true,
            mimeType: true,
          },
        })
      : [];

    const galleryMap = new Map(
      galleryRows.flatMap(item => {
        const sourceId = this.toNumericSourceId(item.sourceId);
        return sourceId === undefined ? [] : [[sourceId, this.mapMedia(item)] as const];
      }),
    );

    const latitude = row.latitude === null ? undefined : Number(row.latitude);
    const longitude = row.longitude === null ? undefined : Number(row.longitude);
    const hasLocation = Boolean(
      row.locationAddress || Number.isFinite(latitude) || Number.isFinite(longitude) || row.mapZoom !== null,
    );

    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? undefined,
      description: row.description ?? undefined,
      featuredText: row.featuredText ?? undefined,
      videoUrl: row.videoUrl ?? undefined,
      duration: row.duration ?? undefined,
      durationValue: row.durationValue ?? undefined,
      durationUnit: row.durationUnit ?? undefined,
      languages: this.jsonArray<string>(row.languagesJson),
      location: hasLocation
        ? {
            address: row.locationAddress ?? undefined,
            latitude: Number.isFinite(latitude) ? latitude : undefined,
            longitude: Number.isFinite(longitude) ? longitude : undefined,
            zoom: row.mapZoom ?? undefined,
          }
        : undefined,
      category: row.categoryLabel ?? undefined,
      featuredMedia: featured ? this.mapMedia(featured) : null,
      gallery: galleryMediaSourceIds
        .map(sourceId => galleryMap.get(sourceId))
        .filter(Boolean),
      galleryMediaSourceIds,
      pricingMode: row.pricingMode === 'FIXED' ? 'fixed' : 'on_request',
      pricing: this.jsonObject(row.pricingJson),
      booking: this.jsonObject(row.bookingJson),
      availability: this.jsonObject(row.availabilityJson),
      contact: this.jsonObject(row.contactJson),
      included: this.jsonArray<string>(row.includedItemsJson),
      excluded: this.jsonArray<string>(row.excludedItemsJson),
      itinerary: this.jsonArray<Record<string, unknown>>(row.itineraryJson),
      faqs: this.jsonArray<Record<string, unknown>>(row.faqsJson),
      practicalInfo: this.jsonObject(row.practicalInfoJson),
      display: this.jsonObject(row.displayJson),
      editorialFlags: this.jsonArray<Record<string, unknown>>(row.editorialFlagsJson),
      sourceUrl: row.sourceUrl ?? undefined,
      status: row.status.toLowerCase(),
      preview: true,
    };
  }
}
