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

export type PublicExperienceAccessibility = {
  available?: boolean;
  details?: string;
};

export type PublicExperienceMeetingPoint = {
  label?: string;
  address?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
};

export type PublicExperiencePickupInformation = {
  available?: boolean;
  details?: string;
  zones: string[];
};

export type PublicExperiencePracticalInfo = {
  whatToBring: string[];
  restrictions: string[];
  accessibility?: PublicExperienceAccessibility;
  minimumAge?: number;
  physicalLevel?: 'low' | 'moderate' | 'high' | 'not_specified';
  meetingPoint?: PublicExperienceMeetingPoint;
  pickupInformation?: PublicExperiencePickupInformation;
  cancellationPolicy?: string;
  bookingNotice?: string;
  requiredDocuments: string[];
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
  practicalInfo?: PublicExperiencePracticalInfo;
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

export type PublicDmcShowcaseItem = {
  id: string;
  slug: string;
  label: string;
  eyebrow?: string;
  title: string;
  description: string;
  media?: PublicMedia | null;
  fallbackImage?: string;
  imageAlt?: string;
  badge?: string;
  facts: string[];
  benefits: string[];
  cta?: {
    label: string;
    href: string;
  };
  order: number;
};

export type PublicDmcService = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  order: number;
  showcase?: {
    title?: string;
    description?: string;
    items: PublicDmcShowcaseItem[];
    secondaryCta?: {
      label: string;
      href: string;
    };
  };
  sourceUrl?: string;
  status: 'published';
};

export type PublicContentSnapshot = {
  generatedAt: string | null;
  source: 'wordpress' | 'manual' | 'unknown';
  experiences: PublicExperience[];
  destinations: PublicDestination[];
  pages: PublicPageContent[];
  media: PublicMedia[];
};
