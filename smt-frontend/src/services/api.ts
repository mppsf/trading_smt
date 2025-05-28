// src/services/api.ts
import { 
  MarketData, 
  SMTSignal,
  SMTAnalysisResponse,
  KillzonesResponse,
  KillzoneInfo,
  HealthStatus, 
  Settings,
  ErrorResponse,
  SMTSignalsParams,
  MarketDataParams
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
        const errorJson: ErrorResponse = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new ApiError(errorMessage, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
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

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        searchParams.append(key, value.join(','));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  return searchParams.toString();
}

export const fetchHealth = async (): Promise<HealthStatus> => {
  return apiRequest<HealthStatus>(`${BASE}/health`);
};

export const fetchSettings = async (): Promise<Settings> => {
  return apiRequest<Settings>(`${BASE}/api/v1/settings`);
};

export const updateSettings = async (payload: Partial<Settings>): Promise<Settings> => {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined && value !== null)
  );
  
  if (Object.keys(cleanPayload).length === 0) {
    throw new Error('No valid settings to update');
  }
  
  return apiRequest<Settings>(`${BASE}/api/v1/settings`, {
    method: 'PUT',
    body: JSON.stringify(cleanPayload),
  });
};

export const fetchMarketData = async (params: MarketDataParams | string = {}): Promise<MarketData[]> => {
  const queryParams = typeof params === 'string' 
    ? { symbols: params, timeframe: '5m' as const, limit: 100 }
    : { symbols: 'ES=F,NQ=F', timeframe: '5m' as const, limit: 100, ...params };
  
  const queryString = buildQueryString(queryParams);
  return apiRequest<MarketData[]>(`${BASE}/api/v1/market-data?${queryString}`);
};

export const fetchSMTSignals = async (params: SMTSignalsParams = {}): Promise<SMTSignal[]> => {
  try {
    const settings = await fetchSettings();
    const mergedParams = { 
      limit: settings.max_signals_display,
      min_strength: settings.smt_strength_threshold,
      ...params 
    };
    
    const queryString = buildQueryString(mergedParams);
    const url = queryString ? `${BASE}/api/v1/smt-signals?${queryString}` : `${BASE}/api/v1/smt-signals`;
    const response = await apiRequest<SMTAnalysisResponse>(url);
    return response.signals || [];
  } catch (error) {
    console.error('Error fetching SMT signals:', error);
    return [];
  }
};

const convertKillzonesToInfo = (killzones: KillzonesResponse): KillzoneInfo | null => {
  if (!killzones?.killzones?.length) return null;
  
  const active = killzones.killzones.find(k => k.is_active);
  const inactive = killzones.killzones.filter(k => !k.is_active);
  
  return {
    current: active?.name || null,
    priority: active ? 'high' : 'low',
    time_remaining: active ? 'Active' : 'None',
    next_session: inactive[0]?.name || 'Unknown'
  };
};

export const fetchKillzones = async (): Promise<KillzoneInfo | null> => {
  try {
    const response = await apiRequest<KillzonesResponse>(`${BASE}/api/v1/killzones`);
    return convertKillzonesToInfo(response);
  } catch (error) {
    console.error('Error fetching killzones:', error);
    return null;
  }
};

export { ApiError };