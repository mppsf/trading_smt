// src/services/api.ts
import { 
  MarketData, 
  SMTSignal, 
  KillzoneInfo,
  HealthStatus, 
  Settings
} from '../types';

const BASE = 'http://localhost:8000';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new ApiError(errorMessage, response.status);
    }

    return response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text() as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Server unavailable', 0);
    }
    throw new ApiError(`Unexpected error: ${error}`, 0);
  }
}

export const fetchMarketData = (symbols: string): Promise<MarketData[]> =>
  apiRequest<MarketData[]>(`${BASE}/api/v1/market-data?symbols=${symbols}`);

export const fetchSMTSignals = (): Promise<SMTSignal[]> =>
  apiRequest<SMTSignal[]>(`${BASE}/api/v1/smt-signals`);

export const fetchKillzones = (): Promise<KillzoneInfo> =>
  apiRequest<KillzoneInfo>(`${BASE}/api/v1/killzones`);

export const fetchHealth = (): Promise<HealthStatus> =>
  apiRequest<HealthStatus>(`${BASE}/health`);

export const fetchSettings = (): Promise<Settings> =>
  apiRequest<Settings>(`${BASE}/api/v1/settings`);

export const updateSettings = (payload: Partial<Settings>): Promise<Settings> =>
  apiRequest<Settings>(`${BASE}/api/v1/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const fetchAllData = async () => {
  const [market, signals, killzone, health] = await Promise.allSettled([
    fetchMarketData('QQQ,SPY'),
    fetchSMTSignals(),
    fetchKillzones(),
    fetchHealth()
  ]);

  return {
    marketData: market.status === 'fulfilled' ? market.value : [],
    smtSignals: signals.status === 'fulfilled' ? signals.value : [],
    killzones: killzone.status === 'fulfilled' ? killzone.value : null,
    health: health.status === 'fulfilled' ? health.value : null,
    settings: null
  };
};

export { ApiError };