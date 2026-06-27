import { User } from '../types';

export const SESSION_KEY = 'prestafacil_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface StoredSession {
  userId: string;
  issuedAt: string;
  expiresAt: string;
  mode?: 'api' | 'demo';
  accessToken?: string;
  refreshToken?: string;
}

export const createPasswordSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

export const hashPassword = async (password: string, salt: string) => {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
};

export const verifyPassword = async (password: string, user: User) => {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const candidate = await hashPassword(password, user.passwordSalt);
  return candidate === user.passwordHash;
};

export const createSession = (userId: string): StoredSession => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);
  return {
    userId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    mode: 'demo',
  };
};

export const createApiSession = (userId: string, accessToken: string, refreshToken: string): StoredSession => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);
  return {
    userId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    mode: 'api',
    accessToken,
    refreshToken,
  };
};

export const isSessionValid = (session: StoredSession | null) => {
  if (!session?.userId || !session.expiresAt) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
};

export const readSession = (): StoredSession | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const persistSession = (session: StoredSession) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('nexus_session_uid');
};
