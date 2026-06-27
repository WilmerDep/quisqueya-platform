export const PLATFORM_TOAST_EVENT = 'platform:toast';
export const PLATFORM_LOADING_EVENT = 'platform:loading';
export const PLATFORM_MODAL_EVENT = 'platform:modal';
export const PLATFORM_BLOCK_STATE_EVENT = 'platform:block-state';
export const PLATFORM_BLOCK_STATE_STORAGE_KEY = 'platform:block-state';

export type PlatformToastTone = 'success' | 'error' | 'info' | 'warning';

export interface PlatformToastDetail {
  id?: string;
  title: string;
  message?: string;
  tone?: PlatformToastTone;
  durationMs?: number;
}

export interface PlatformLoadingDetail {
  active: boolean;
  label?: string;
}

export interface PlatformModalDetail {
  id: string;
  title?: string;
  state: 'open' | 'close';
}

export type PlatformCriticalModalTone = 'info' | 'warning' | 'danger' | 'success';

export interface PlatformCriticalModalHighlight {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}

export interface PlatformCriticalModalDetail extends PlatformModalDetail {
  description?: string;
  tone?: PlatformCriticalModalTone;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  highlights?: PlatformCriticalModalHighlight[];
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onSecondary?: () => void;
}

export type PlatformBlockingStateKind = 'session-expired' | 'permission-denied';

export interface PlatformBlockingStateDetail {
  id: string;
  state: 'open' | 'close';
  kind: PlatformBlockingStateKind;
  title: string;
  message: string;
  primaryLabel: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  dismissible?: boolean;
}

const emitPlatformEvent = <T>(eventName: string, detail: T) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

export const emitPlatformToast = (detail: PlatformToastDetail) => {
  emitPlatformEvent<PlatformToastDetail>(PLATFORM_TOAST_EVENT, detail);
};

export const setPlatformLoading = (detail: PlatformLoadingDetail) => {
  emitPlatformEvent<PlatformLoadingDetail>(PLATFORM_LOADING_EVENT, detail);
};

export const emitPlatformModalState = (detail: PlatformModalDetail) => {
  emitPlatformEvent<PlatformModalDetail>(PLATFORM_MODAL_EVENT, detail);
};

export const openPlatformCriticalModal = (detail: Omit<PlatformCriticalModalDetail, 'state'>) => {
  emitPlatformEvent<PlatformCriticalModalDetail>(PLATFORM_MODAL_EVENT, { ...detail, state: 'open' });
};

export const closePlatformCriticalModal = (id = 'platform-critical-modal') => {
  emitPlatformEvent<PlatformModalDetail>(PLATFORM_MODAL_EVENT, { id, state: 'close' });
};

export const readPlatformBlockingState = (): PlatformBlockingStateDetail | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PLATFORM_BLOCK_STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlatformBlockingStateDetail;
  } catch {
    window.localStorage.removeItem(PLATFORM_BLOCK_STATE_STORAGE_KEY);
    return null;
  }
};

export const openPlatformBlockingState = (detail: Omit<PlatformBlockingStateDetail, 'state'>) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PLATFORM_BLOCK_STATE_STORAGE_KEY, JSON.stringify({ ...detail, state: 'open' }));
  }
  emitPlatformEvent<PlatformBlockingStateDetail>(PLATFORM_BLOCK_STATE_EVENT, { ...detail, state: 'open' });
};

export const closePlatformBlockingState = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PLATFORM_BLOCK_STATE_STORAGE_KEY);
  }
  emitPlatformEvent<PlatformBlockingStateDetail>(PLATFORM_BLOCK_STATE_EVENT, {
    id: 'platform-block-state',
    state: 'close',
    kind: 'session-expired',
    title: '',
    message: '',
    primaryLabel: '',
  });
};
