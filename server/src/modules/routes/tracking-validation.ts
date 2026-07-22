export interface SaveLocationPayload {
  collectorId?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery?: number;
}

export type TrackingConnectivityStatus = 'ONLINE' | 'STALE' | 'OFFLINE';

export interface ConnectivityConfig {
  staleThresholdMs: number; // default 5 min (300,000 ms)
  offlineThresholdMs: number; // default 15 min (900,000 ms)
  maxFutureToleranceMs: number; // default 60 sec (60,000 ms)
}

export const DEFAULT_CONNECTIVITY_CONFIG: ConnectivityConfig = {
  staleThresholdMs: 5 * 60 * 1000,
  offlineThresholdMs: 15 * 60 * 1000,
  maxFutureToleranceMs: 60 * 1000,
};

export function validateLocationPayload(body: SaveLocationPayload): { isValid: boolean; error?: string } {
  if (body.lat === undefined || body.lat === null || typeof body.lat !== 'number' || !Number.isFinite(body.lat)) {
    return { isValid: false, error: 'Latitud es requerida y debe ser un número finito.' };
  }
  if (body.lat < -90 || body.lat > 90) {
    return { isValid: false, error: 'Latitud fuera de rango [-90, 90].' };
  }

  if (body.lng === undefined || body.lng === null || typeof body.lng !== 'number' || !Number.isFinite(body.lng)) {
    return { isValid: false, error: 'Longitud es requerida y debe ser un número finito.' };
  }
  if (body.lng < -180 || body.lng > 180) {
    return { isValid: false, error: 'Longitud fuera de rango [-180, 180].' };
  }

  if (body.accuracy !== undefined && body.accuracy !== null) {
    if (typeof body.accuracy !== 'number' || !Number.isFinite(body.accuracy) || body.accuracy < 0 || body.accuracy > 10000) {
      return { isValid: false, error: 'Precisión inválida.' };
    }
  }

  if (body.speed !== undefined && body.speed !== null) {
    if (typeof body.speed !== 'number' || !Number.isFinite(body.speed) || body.speed < 0 || body.speed > 300) {
      return { isValid: false, error: 'Velocidad inválida.' };
    }
  }

  if (body.heading !== undefined && body.heading !== null) {
    if (typeof body.heading !== 'number' || !Number.isFinite(body.heading) || body.heading < 0 || body.heading > 360) {
      return { isValid: false, error: 'Rumbo (heading) inválido.' };
    }
  }

  if (body.battery !== undefined && body.battery !== null) {
    if (typeof body.battery !== 'number' || !Number.isInteger(body.battery) || body.battery < 0 || body.battery > 100) {
      return { isValid: false, error: 'Batería inválida.' };
    }
  }

  return { isValid: true };
}

export function calculateTrackingConnectivity(
  lastPointDate: Date | string | null | undefined,
  nowMs: number = Date.now(),
  config: ConnectivityConfig = DEFAULT_CONNECTIVITY_CONFIG
): TrackingConnectivityStatus {
  if (!lastPointDate) return 'OFFLINE';

  const pointMs = new Date(lastPointDate).getTime();
  if (isNaN(pointMs)) return 'OFFLINE';

  const diffMs = nowMs - pointMs;
  if (diffMs < 0) {
    // Si la fecha es en el futuro, tolerar hasta maxFutureToleranceMs (60s)
    if (Math.abs(diffMs) <= config.maxFutureToleranceMs) {
      return 'ONLINE';
    }
    return 'OFFLINE';
  }

  if (diffMs <= config.staleThresholdMs) {
    return 'ONLINE';
  } else if (diffMs <= config.offlineThresholdMs) {
    return 'STALE';
  } else {
    return 'OFFLINE';
  }
}

