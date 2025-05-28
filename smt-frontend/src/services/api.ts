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

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return data;
    } else {
      return await response.text() as unknown as T;
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Server unavailable', 0);
    }
    throw new ApiError(`Unexpected error: ${error}`, 0);
  }
}

export const fetchMarketData = async (symbols: string): Promise<MarketData[]> => {
  try {
    const data = await apiRequest<MarketData[]>(`${BASE}/api/v1/market-data?symbols=${symbols}`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    return [];
  }
};

export const fetchSMTSignals = async (): Promise<SMTSignal[]> => {
  try {
    const data = await apiRequest<SMTSignal[]>(`${BASE}/api/v1/smt-signals`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch SMT signals:', error);
    return [];
  }
};

export const fetchKillzones = (): Promise<KillzoneInfo> =>
  apiRequest<KillzoneInfo>(`${BASE}/api/v1/killzones`);

export const fetchHealth = (): Promise<HealthStatus> =>
  apiRequest<HealthStatus>(`${BASE}/health`);

export const fetchSettings = async (): Promise<Settings> => {
  try {
    const data = await apiRequest<Settings>(`${BASE}/api/v1/settings`);
    // Ensure we return a valid Settings object with default values
    const defaultSettings: Settings = {
      smt_strength_threshold: 0.7,
      killzone_priorities: [1, 2, 3],
      refresh_interval: 30000,
      max_signals_display: 10
    };
    
    // Merge with fetched data, ensuring all required fields exist
    return { ...defaultSettings, ...data };
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    // Return default settings if fetch fails
    return {
      smt_strength_threshold: 0.7,
      killzone_priorities: [1, 2, 3],
      refresh_interval: 30000,
      max_signals_display: 10
    };
  }
};

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