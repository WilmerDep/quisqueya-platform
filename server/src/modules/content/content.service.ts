import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  PublicContentSnapshot,
  PublicDestination,
  PublicExperience,
  PublicMedia,
  PublicPageContent,
} from './content.types.js';

const EMPTY_SNAPSHOT: PublicContentSnapshot = {
  generatedAt: null,
  source: 'unknown',
  experiences: [],
  destinations: [],
  pages: [],
  media: [],
};

@Injectable()
export class ContentService {
  private readonly snapshotPath = join(process.cwd(), 'data', 'content', 'snapshot.json');

  private async readSnapshot(): Promise<PublicContentSnapshot> {
    try {
      const raw = await readFile(this.snapshotPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PublicContentSnapshot>;
      return {
        generatedAt: parsed.generatedAt ?? null,
        source: parsed.source ?? 'unknown',
        experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
        destinations: Array.isArray(parsed.destinations) ? parsed.destinations : [],
        pages: Array.isArray(parsed.pages) ? parsed.pages : [],
        media: Array.isArray(parsed.media) ? parsed.media : [],
      };
    } catch {
      return EMPTY_SNAPSHOT;
    }
  }

  async getSnapshot(): Promise<PublicContentSnapshot> {
    return this.readSnapshot();
  }

  async getExperiences(): Promise<PublicExperience[]> {
    return (await this.readSnapshot()).experiences;
  }

  async getExperience(slug: string): Promise<PublicExperience | null> {
    return (await this.getExperiences()).find(item => item.slug === slug) ?? null;
  }

  async getDestinations(): Promise<PublicDestination[]> {
    return (await this.readSnapshot()).destinations;
  }

  async getDestination(slug: string): Promise<PublicDestination | null> {
    return (await this.getDestinations()).find(item => item.slug === slug) ?? null;
  }

  async getPages(): Promise<PublicPageContent[]> {
    return (await this.readSnapshot()).pages;
  }

  async getPage(slug: string): Promise<PublicPageContent | null> {
    return (await this.getPages()).find(item => item.slug === slug) ?? null;
  }

  async getMedia(): Promise<PublicMedia[]> {
    return (await this.readSnapshot()).media;
  }
}
