import { Injectable } from '@nestjs/common';
import { ContentRecordStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import type { PublicDmcService, PublicDmcShowcaseItem } from './content.types.js';

const DMC_CONTENT_SLUG = 'dmc-services';

type JsonObject = Record<string, unknown>;

@Injectable()
export class DmcContentService {
  constructor(private readonly prisma: PrismaService) {}

  private object(value: unknown): JsonObject | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as JsonObject
      : undefined;
  }

  private text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private integer(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  private strings(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
      : [];
  }

  private parseShowcaseItem(value: unknown, index: number): PublicDmcShowcaseItem | null {
    const item = this.object(value);
    if (!item) return null;

    const id = this.text(item.id);
    const slug = this.text(item.slug);
    const label = this.text(item.label);
    const title = this.text(item.title);
    const description = this.text(item.description);

    if (!id || !slug || !label || !title || !description) return null;

    const ctaRaw = this.object(item.cta);
    const ctaLabel = this.text(ctaRaw?.label);
    const ctaHref = this.text(ctaRaw?.href);

    return {
      id,
      slug,
      label,
      eyebrow: this.text(item.eyebrow),
      title,
      description,
      fallbackImage: this.text(item.fallbackImage),
      imageAlt: this.text(item.imageAlt),
      badge: this.text(item.badge),
      facts: this.strings(item.facts),
      benefits: this.strings(item.benefits),
      cta: ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : undefined,
      order: this.integer(item.order, index),
    };
  }

  private parseService(value: unknown, index: number): PublicDmcService | null {
    const service = this.object(value);
    if (!service) return null;

    const id = this.text(service.id);
    const slug = this.text(service.slug);
    const title = this.text(service.title);
    const shortDescription = this.text(service.shortDescription);

    if (!id || !slug || !title || !shortDescription) return null;

    const showcaseRaw = this.object(service.showcase);
    const secondaryCtaRaw = this.object(showcaseRaw?.secondaryCta);
    const secondaryCtaLabel = this.text(secondaryCtaRaw?.label);
    const secondaryCtaHref = this.text(secondaryCtaRaw?.href);
    const items = Array.isArray(showcaseRaw?.items)
      ? showcaseRaw.items
        .map((item, itemIndex) => this.parseShowcaseItem(item, itemIndex))
        .filter((item): item is PublicDmcShowcaseItem => Boolean(item))
        .sort((a, b) => a.order - b.order)
      : [];

    return {
      id,
      slug,
      title,
      shortDescription,
      order: this.integer(service.order, index),
      showcase: showcaseRaw
        ? {
            title: this.text(showcaseRaw.title),
            description: this.text(showcaseRaw.description),
            items,
            secondaryCta: secondaryCtaLabel && secondaryCtaHref
              ? { label: secondaryCtaLabel, href: secondaryCtaHref }
              : undefined,
          }
        : undefined,
      sourceUrl: this.text(service.sourceUrl),
      status: 'published',
    };
  }

  async getServices(): Promise<PublicDmcService[]> {
    const page = await this.prisma.contentPage.findFirst({
      where: {
        slug: DMC_CONTENT_SLUG,
        status: ContentRecordStatus.PUBLISHED,
      },
      select: { content: true },
    });

    if (!page?.content) return [];

    let payload: unknown;
    try {
      payload = JSON.parse(page.content);
    } catch {
      return [];
    }

    const root = this.object(payload);
    const rawServices = Array.isArray(payload)
      ? payload
      : Array.isArray(root?.services)
        ? root.services
        : [];

    return rawServices
      .map((service, index) => this.parseService(service, index))
      .filter((service): service is PublicDmcService => Boolean(service))
      .sort((a, b) => a.order - b.order);
  }
}
