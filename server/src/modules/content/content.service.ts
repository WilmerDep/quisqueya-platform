import { Injectable } from '@nestjs/common';
import { ContentRecordStatus, ContentSourceProvider, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import type {
  PublicContentSnapshot,
  PublicDestination,
  PublicDestinationEditorialFlag,
  PublicDestinationSection,
  PublicExperience,
  PublicExperienceEditorialFlag,
  PublicExperiencePracticalInfo,
  PublicMedia,
  PublicPageContent,
} from './content.types.js';

type ExperienceRow = Prisma.ExperienceGetPayload<Record<string, never>>;
type DestinationRow = Prisma.DestinationGetPayload<Record<string, never>>;

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

  private jsonArray<T>(value: Prisma.JsonValue | null): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
    return value as Record<string, unknown>;
  }

  private practicalInfo(value: Prisma.JsonValue | null): PublicExperiencePracticalInfo | undefined {
    const raw = this.jsonObject(value);
    if (!raw) return undefined;

    const strings = (candidate: unknown): string[] =>
      Array.isArray(candidate)
        ? candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    const text = (candidate: unknown): string | undefined =>
      typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
    const finiteNumber = (candidate: unknown): number | undefined => {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const object = (candidate: unknown): Record<string, unknown> | undefined =>
      candidate && !Array.isArray(candidate) && typeof candidate === 'object'
        ? candidate as Record<string, unknown>
        : undefined;

    const accessibilityRaw = object(raw.accessibility);
    const meetingPointRaw = object(raw.meetingPoint);
    const pickupRaw = object(raw.pickupInformation);
    const physicalLevel = ['low', 'moderate', 'high', 'not_specified'].includes(String(raw.physicalLevel))
      ? raw.physicalLevel as PublicExperiencePracticalInfo['physicalLevel']
      : undefined;

    const practicalInfo: PublicExperiencePracticalInfo = {
      whatToBring: strings(raw.whatToBring),
      restrictions: strings(raw.restrictions),
      requiredDocuments: strings(raw.requiredDocuments),
      accessibility: accessibilityRaw
        ? {
            available: typeof accessibilityRaw.available === 'boolean' ? accessibilityRaw.available : undefined,
            details: text(accessibilityRaw.details),
          }
        : undefined,
      minimumAge: finiteNumber(raw.minimumAge),
      physicalLevel,
      meetingPoint: meetingPointRaw
        ? {
            label: text(meetingPointRaw.label),
            address: text(meetingPointRaw.address),
            instructions: text(meetingPointRaw.instructions),
            latitude: finiteNumber(meetingPointRaw.latitude),
            longitude: finiteNumber(meetingPointRaw.longitude),
          }
        : undefined,
      pickupInformation: pickupRaw
        ? {
            available: typeof pickupRaw.available === 'boolean' ? pickupRaw.available : undefined,
            details: text(pickupRaw.details),
            zones: strings(pickupRaw.zones),
          }
        : undefined,
      cancellationPolicy: text(raw.cancellationPolicy),
      bookingNotice: text(raw.bookingNotice),
    };

    const hasContent = Boolean(
      practicalInfo.whatToBring.length ||
      practicalInfo.restrictions.length ||
      practicalInfo.requiredDocuments.length ||
      practicalInfo.accessibility ||
      practicalInfo.minimumAge !== undefined ||
      practicalInfo.physicalLevel ||
      practicalInfo.meetingPoint ||
      practicalInfo.pickupInformation ||
      practicalInfo.cancellationPolicy ||
      practicalInfo.bookingNotice,
    );

    return hasContent ? practicalInfo : undefined;
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

  private async mediaBySourceIdMap(sourceIds: number[]): Promise<Map<number, PublicMedia>> {
    const normalized = [...new Set(sourceIds.filter(Number.isFinite))];
    if (!normalized.length) return new Map();

    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        sourceProvider: ContentSourceProvider.WORDPRESS,
        sourceId: { in: normalized.map(String) },
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
    });

    return new Map(
      rows.flatMap(row => {
        const sourceId = this.toNumericSourceId(row.sourceId);
        return sourceId === undefined ? [] : [[sourceId, this.mapMedia(row)] as const];
      }),
    );
  }

  private mapExperience(
    row: ExperienceRow,
    featuredMedia: PublicMedia | null,
    galleryBySourceId: Map<number, PublicMedia>,
  ): PublicExperience {
    const galleryMediaSourceIds = this.jsonArray<number>(row.galleryMediaSourceIds)
      .map(Number)
      .filter(Number.isFinite);
    const latitude = row.latitude === null ? undefined : Number(row.latitude);
    const longitude = row.longitude === null ? undefined : Number(row.longitude);
    const hasLocation = Boolean(
      row.locationAddress ||
      Number.isFinite(latitude) ||
      Number.isFinite(longitude) ||
      row.mapZoom !== null,
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
      featuredMedia,
      gallery: galleryMediaSourceIds
        .map(sourceId => galleryBySourceId.get(sourceId))
        .filter((media): media is PublicMedia => Boolean(media)),
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
      practicalInfo: this.practicalInfo(row.practicalInfoJson),
      display: this.jsonObject(row.displayJson),
      editorialFlags: this.jsonArray<PublicExperienceEditorialFlag>(row.editorialFlagsJson),
      sourceUrl: row.sourceUrl ?? undefined,
      status: row.status.toLowerCase(),
    };
  }

  private mapDestination(
    row: DestinationRow,
    featuredMedia: PublicMedia | null,
    mediaBySourceId: Map<number, PublicMedia>,
  ): PublicDestination {
    const galleryMediaSourceIds = this.jsonArray<number>(row.galleryMediaSourceIds)
      .map(Number)
      .filter(Number.isFinite);
    const rawSections = this.jsonArray<Record<string, unknown>>(row.contentSectionsJson);
    const contentSections: PublicDestinationSection[] = rawSections
      .map((section, index) => {
        const mediaSourceId = Number(section.mediaSourceId);
        const normalizedMediaSourceId = Number.isFinite(mediaSourceId) ? mediaSourceId : undefined;
        const items = Array.isArray(section.items)
          ? section.items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        const mediaPosition = ['before', 'after', 'left', 'right', 'full'].includes(String(section.mediaPosition))
          ? section.mediaPosition as PublicDestinationSection['mediaPosition']
          : undefined;

        return {
          id: typeof section.id === 'string' && section.id.trim() ? section.id : `section-${index + 1}`,
          eyebrow: typeof section.eyebrow === 'string' ? section.eyebrow : undefined,
          title: typeof section.title === 'string' ? section.title : undefined,
          content: typeof section.content === 'string' ? section.content : undefined,
          items,
          media: normalizedMediaSourceId ? mediaBySourceId.get(normalizedMediaSourceId) ?? null : null,
          mediaSourceId: normalizedMediaSourceId,
          mediaPosition,
          anchor: typeof section.anchor === 'string' ? section.anchor : undefined,
          order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
        };
      })
      .sort((a, b) => a.order - b.order);
    const location = this.jsonObject(row.locationJson);

    return {
      id: row.id,
      sourceId: this.toNumericSourceId(row.sourceId),
      slug: row.slug,
      name: row.name,
      excerpt: row.excerpt ?? undefined,
      description: row.description ?? undefined,
      featuredText: row.featuredText ?? undefined,
      featuredMedia,
      gallery: galleryMediaSourceIds
        .map(sourceId => mediaBySourceId.get(sourceId))
        .filter((media): media is PublicMedia => Boolean(media)),
      galleryMediaSourceIds,
      contentSections,
      location: location
        ? {
            country: typeof location.country === 'string' ? location.country : undefined,
            region: typeof location.region === 'string' ? location.region : undefined,
            address: typeof location.address === 'string' ? location.address : undefined,
            latitude: Number.isFinite(Number(location.latitude)) ? Number(location.latitude) : undefined,
            longitude: Number.isFinite(Number(location.longitude)) ? Number(location.longitude) : undefined,
            zoom: Number.isFinite(Number(location.zoom)) ? Number(location.zoom) : undefined,
          }
        : undefined,
      display: this.jsonObject(row.displayJson),
      editorialFlags: this.jsonArray<PublicDestinationEditorialFlag>(row.editorialFlagsJson),
      sourceUrl: row.sourceUrl ?? undefined,
      status: row.status.toLowerCase(),
    };
  }

  async getExperiences(): Promise<PublicExperience[]> {
    const rows = await this.prisma.experience.findMany({
      where: { status: ContentRecordStatus.PUBLISHED },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    const featuredMedia = await this.mediaMap(rows.map(row => row.featuredMediaId));
    const gallerySourceIds = rows.flatMap(row => this.jsonArray<number>(row.galleryMediaSourceIds));
    const galleryMedia = await this.mediaBySourceIdMap(gallerySourceIds);

    return rows.map(row => this.mapExperience(
      row,
      row.featuredMediaId ? featuredMedia.get(row.featuredMediaId) ?? null : null,
      galleryMedia,
    ));
  }

  async getExperience(slug: string): Promise<PublicExperience | null> {
    const row = await this.prisma.experience.findFirst({
      where: { slug, status: ContentRecordStatus.PUBLISHED },
    });
    if (!row) return null;

    const featuredMedia = await this.mediaMap([row.featuredMediaId]);
    const gallerySourceIds = this.jsonArray<number>(row.galleryMediaSourceIds);
    const galleryMedia = await this.mediaBySourceIdMap(gallerySourceIds);

    return this.mapExperience(
      row,
      row.featuredMediaId ? featuredMedia.get(row.featuredMediaId) ?? null : null,
      galleryMedia,
    );
  }

  async getDestinations(): Promise<PublicDestination[]> {
    const rows = await this.prisma.destination.findMany({
      where: { status: ContentRecordStatus.PUBLISHED },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const featuredMedia = await this.mediaMap(rows.map(row => row.featuredMediaId));
    const sourceIds = rows.flatMap(row => [
      ...this.jsonArray<number>(row.galleryMediaSourceIds),
      ...this.jsonArray<Record<string, unknown>>(row.contentSectionsJson)
        .map(section => Number(section.mediaSourceId))
        .filter(Number.isFinite),
    ]);
    const mediaBySourceId = await this.mediaBySourceIdMap(sourceIds);

    return rows.map(row => this.mapDestination(
      row,
      row.featuredMediaId ? featuredMedia.get(row.featuredMediaId) ?? null : null,
      mediaBySourceId,
    ));
  }

  async getDestination(slug: string): Promise<PublicDestination | null> {
    const row = await this.prisma.destination.findFirst({
      where: { slug, status: ContentRecordStatus.PUBLISHED },
    });
    if (!row) return null;

    const featuredMedia = await this.mediaMap([row.featuredMediaId]);
    const sourceIds = [
      ...this.jsonArray<number>(row.galleryMediaSourceIds),
      ...this.jsonArray<Record<string, unknown>>(row.contentSectionsJson)
        .map(section => Number(section.mediaSourceId))
        .filter(Number.isFinite),
    ];
    const mediaBySourceId = await this.mediaBySourceIdMap(sourceIds);

    return this.mapDestination(
      row,
      row.featuredMediaId ? featuredMedia.get(row.featuredMediaId) ?? null : null,
      mediaBySourceId,
    );
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
