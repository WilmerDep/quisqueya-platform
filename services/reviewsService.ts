import { readSession } from './authService';

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';

export interface ReviewRecord {
  id: string;
  source: 'google' | 'manual';
  externalId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  reviewText: string;
  language: string | null;
  reviewUrl: string | null;
  reviewedAt: string | null;
  status: ReviewStatus;
  featured: boolean;
  sortOrder: number;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ApiEnvelope<T> = { data: T };

const API_BASE_URL =
  ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = readSession()?.accessToken;
  if (!token) throw new Error('Missing API session');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'La API no respondió correctamente.');
  }
  return payload as T;
};

export const reviewsService = {
  async list(): Promise<ReviewRecord[]> {
    const response = await request<ApiEnvelope<ReviewRecord[]>>('/reviews');
    return response.data;
  },

  async update(reviewId: string, payload: Partial<Pick<ReviewRecord, 'status' | 'featured' | 'sortOrder'>>): Promise<ReviewRecord> {
    const response = await request<ApiEnvelope<ReviewRecord>>(`/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
