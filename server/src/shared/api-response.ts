export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export const ok = <T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> => ({
  data,
  ...(meta ? { meta } : {}),
});
