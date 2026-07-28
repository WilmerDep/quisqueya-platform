import { Injectable } from '@nestjs/common';
import { ContentRecordStatus, ContentSourceProvider } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import type {
  PublicContentSnapshot,
  PublicDestination,
  PublicExperience,
  PublicMedia,
  PublicPageContent,
} from './content.types.js';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumericSourceId(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private sourceName(providers: ContentSourceProvider[]): PublicContentSnapshot['source'] {
    const unique = new Set(providers);
    if (unique.size === 1 && unique.has(ContentSourceProvider.WORDPRESS)) return 'wordpress';
    if (unique.size === 1 && unique.has(ContentSourceProvider.MANUAL)) return 'manual';
    return 'unknown';
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
  }): PublicMedia {
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

  private async mediaMap(ids: Array<string | null>): Promise<Map<string, PublicMedia>> {
    const mediaIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!mediaIds.length) return new Map();

    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds } },
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
    });

    return new Map(rows.map(row => [row.id, this.mapMedia(row)]));
  }

  async getExperiences(): Promise<PublicExperience[]> {
    const rows = await this.prisma.experience.findMany({
      where: { status: ContentRecordStatus.PUBLISHED },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    const media = await this.mediaMap(rows.map(row => row.featuredMediaId));

    return rows.map(row => ({
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? undefined,
      description: row.description ?? undefined,
      duration: row.duration ?? undefined,
      category: row.categoryLabel ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
      status: row.status.toLowerCase(),
    }));
  }

  async getExperience(slug: string): Promise<PublicExperience | null> {
    const row = await this.prisma.experience.findFirst({
      where: { slug, status: ContentRecordStatus.PUBLISHED },
    });
    if (!row) return null;
    const media = await this.mediaMap([row.featuredMediaId]);

    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? undefined,
      description: row.description ?? undefined,
      duration: row.duration ?? undefined,
      category: row.categoryLabel ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
      status: row.status.toLowerCase(),
    };
  }

  async getDestinations(): Promise<PublicDestination[]> {
    const rows = await this.prisma.destination.findMany({
      where: { status: ContentRecordStatus.PUBLISHED },
      orderBy: { name: 'asc' },
    });
    const media = await this.mediaMap(rows.map(row => row.featuredMediaId));

    return rows.map(row => ({
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
    }));
  }

  async getDestination(slug: string): Promise<PublicDestination | null> {
    const row = await this.prisma.destination.findFirst({
      where: { slug, status: ContentRecordStatus.PUBLISHED },
    });
    if (!row) return null;
    const media = await this.mediaMap([row.featuredMediaId]);

    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
    };
  }

  async getPages(): Promise<PublicPageContent[]> {
    const rows = await this.prisma.contentPage.findMany({
      where: { status: ContentRecordStatus.PUBLISHED },
      orderBy: { title: 'asc' },
    });
    const media = await this.mediaMap(rows.map(row => row.featuredMediaId));

    return rows.map(row => ({
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      title: row.title,
      content: row.content ?? undefined,
      excerpt: row.excerpt ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
    }));
  }

  async getPage(slug: string): Promise<PublicPageContent | null> {
    const row = await this.prisma.contentPage.findFirst({
      where: { slug, status: ContentRecordStatus.PUBLISHED },
    });
    if (!row) return null;
    const media = await this.mediaMap([row.featuredMediaId]);

    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      title: row.title,
      content: row.content ?? undefined,
      excerpt: row.excerpt ?? undefined,
      featuredMedia: row.featuredMediaId ? media.get(row.featuredMediaId) ?? null : null,
      sourceUrl: row.sourceUrl ?? undefined,
    };
  }

  async getMedia(): Promise<PublicMedia[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'asc' },
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
    });
    return rows.map(row => this.mapMedia(row));
  }

  async getSnapshot(): Promise<PublicContentSnapshot> {
    const [experiences, destinations, pages, media, providers, latest] = await Promise.all([
      this.getExperiences(),
      this.getDestinations(),
      this.getPages(),
      this.getMedia(),
      Promise.all([
        this.prisma.experience.findMany({ select: { sourceProvider: true } }),
        this.prisma.destination.findMany({ select: { sourceProvider: true } }),
        this.prisma.contentPage.findMany({ select: { sourceProvider: true } }),
      ]),
      Promise.all([
        this.prisma.experience.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        this.prisma.destination.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        this.prisma.contentPage.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        this.prisma.mediaAsset.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      ]),
    ]);

    const sourceProviders = providers.flat().map(item => item.sourceProvider);
    const latestDate = latest
      .map(item => item?.updatedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      generatedAt: latestDate?.toISOString() ?? null,
      source: this.sourceName(sourceProviders),
      experiences,
      destinations,
      pages,
      media,
    };
  }
}
