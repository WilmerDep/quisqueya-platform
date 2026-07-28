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

export type PublicExperienceLocation = {
  address?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
};

export type PublicExperienceEditorialFlag = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

export type PublicExperience = {
  id: string;
  sourceId?: number;
  slug: string;
  title: string;
  excerpt?: string;
  description?: string;
  featuredText?: string;
  videoUrl?: string;
  duration?: string;
  durationValue?: number;
  durationUnit?: string;
  languages: string[];
  location?: PublicExperienceLocation;
  category?: string;
  featuredMedia?: PublicMedia | null;
  gallery: PublicMedia[];
  galleryMediaSourceIds: number[];
  pricingMode: 'fixed' | 'on_request';
  pricing?: Record<string, unknown>;
  booking?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  included: string[];
  excluded: string[];
  itinerary: Array<Record<string, unknown>>;
  faqs: Array<Record<string, unknown>>;
  display?: Record<string, unknown>;
  editorialFlags: PublicExperienceEditorialFlag[];
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
