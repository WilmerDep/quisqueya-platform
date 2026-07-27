export type PublicMedia = {
  id: string;
  sourceId?: number;
  sourceUrl?: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type PublicExperience = {
  id: string;
  sourceId?: number;
  slug: string;
  title: string;
  excerpt?: string;
  description?: string;
  duration?: string;
  category?: string;
  featuredMedia?: PublicMedia | null;
  sourceUrl?: string;
  status?: string;
};

export type PublicDestination = {
  id: string;
  sourceId?: number;
  slug: string;
  name: string;
  description?: string;
  featuredMedia?: PublicMedia | null;
  sourceUrl?: string;
};

export type PublicPageContent = {
  id: string;
  sourceId?: number;
  slug: string;
  title: string;
  content?: string;
  excerpt?: string;
  featuredMedia?: PublicMedia | null;
  sourceUrl?: string;
};

export type PublicContentSnapshot = {
  generatedAt: string | null;
  source: 'wordpress' | 'manual' | 'unknown';
  experiences: PublicExperience[];
  destinations: PublicDestination[];
  pages: PublicPageContent[];
  media: PublicMedia[];
};
