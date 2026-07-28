import { readSession } from './authService';

export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ContactRecord {
  id: string;
  companyId: string;
  ownerUserId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  countryCode: string | null;
  preferredLanguage: string | null;
  source: string | null;
  notes: string | null;
  status: ContactStatus;
  provenanceJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  ownerUserId?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  countryCode?: string | null;
  preferredLanguage?: string | null;
  source?: string | null;
  notes?: string | null;
  status?: ContactStatus;
}

type ApiEnvelope<T> = { data: T };

const API_BASE_URL =
  ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');

const authHeaders = () => {
  const token = readSession()?.accessToken;
  if (!token) throw new Error('Missing API session');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'La API no respondió correctamente.');
  }
  return payload as T;
};

export const contactsService = {
  async list(params: { search?: string; status?: ContactStatus } = {}): Promise<ContactRecord[]> {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await request<ApiEnvelope<ContactRecord[]>>(`/contacts${suffix}`);
    return response.data;
  },

  async get(contactId: string): Promise<ContactRecord> {
    const response = await request<ApiEnvelope<ContactRecord>>(`/contacts/${contactId}`);
    return response.data;
  },

  async create(payload: ContactInput): Promise<ContactRecord> {
    const response = await request<ApiEnvelope<ContactRecord>>('/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async update(contactId: string, payload: Partial<ContactInput>): Promise<ContactRecord> {
    const response = await request<ApiEnvelope<ContactRecord>>(`/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
