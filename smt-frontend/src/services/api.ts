// src/services/api.ts
import { 
  MarketData, 
  SMTSignal,
  SMTAnalysisResponse,
  AnalysisStats,
  TrueOpensResponse,
  FractalsResponse,
  VolumeAnomaly,
  KillzonesResponse,
  HealthStatus, 
  Settings,
  ErrorResponse,
  SMTSignalsParams,
  MarketDataParams,
  FractalsParams,
  VolumeAnomaliesParams
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

// Health
export const fetchHealth = async (): Promise<HealthStatus> => {
  return apiRequest<HealthStatus>(`${BASE}/health`);
};

// Settings
export const fetchSettings = async (): Promise<Settings> => {
  const data = await apiRequest<Settings>(`${BASE}/api/v1/settings`);
  return data;
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

// Market Data
export const fetchMarketData = async (params: MarketDataParams = {}): Promise<MarketData[]> => {
  const defaultParams = {
    symbols: 'ES=F,NQ=F',
    timeframe: '5m' as const,
    limit: 100
  };
  
  const queryString = buildQueryString({ ...defaultParams, ...params });
  return apiRequest<MarketData[]>(`${BASE}/api/v1/market-data?${queryString}`);
};

// SMT Analysis
export const fetchSMTAnalysis = async (params: Partial<SMTSignalsParams> = {}): Promise<SMTAnalysisResponse> => {
  const queryString = buildQueryString(params);
  const url = queryString ? `${BASE}/api/v1/smt-analysis?${queryString}` : `${BASE}/api/v1/smt-analysis`;
  return apiRequest<SMTAnalysisResponse>(url);
};

export const fetchSMTSignals = async (params: SMTSignalsParams = {}): Promise<SMTSignal[]> => {
  const queryString = buildQueryString(params);
  const url = queryString ? `${BASE}/api/v1/smt-signals?${queryString}` : `${BASE}/api/v1/smt-signals`;
  const response = await apiRequest<SMTAnalysisResponse>(url);
  return response.signals || [];
};

export const fetchSMTStats = async (): Promise<AnalysisStats> => {
  return apiRequest<AnalysisStats>(`${BASE}/api/v1/smt-analysis/stats`);
};

// True Opens
export const fetchTrueOpens = async (): Promise<TrueOpensResponse> => {
  return apiRequest<TrueOpensResponse>(`${BASE}/api/v1/true-opens`);
};

// Fractals
export const fetchFractals = async (params: FractalsParams = {}): Promise<FractalsResponse> => {
  const defaultParams = { symbol: 'ES=F', limit: 20 };
  const queryString = buildQueryString({ ...defaultParams, ...params });
  return apiRequest<FractalsResponse>(`${BASE}/api/v1/fractals?${queryString}`);
};

// Volume Anomalies
export const fetchVolumeAnomalies = async (params: VolumeAnomaliesParams = {}): Promise<VolumeAnomaly[]> => {
  const defaultParams = { symbol: 'ES=F', threshold: 2.0, limit: 10 };
  const queryString = buildQueryString({ ...defaultParams, ...params });
  return apiRequest<VolumeAnomaly[]>(`${BASE}/api/v1/volume-anomalies?${queryString}`);
};

// Killzones
export const fetchKillzones = async (): Promise<KillzonesResponse> => {
  return apiRequest<KillzonesResponse>(`${BASE}/api/v1/killzones`);
};

// Комплексная загрузка данных
export const fetchAllData = async () => {
  const [market, signals, killzones, health, settings] = await Promise.allSettled([
    fetchMarketData(),
    fetchSMTSignals(),
    fetchKillzones(),
    fetchHealth(),
    fetchSettings()
  ]);

  return {
    marketData: market.status === 'fulfilled' ? market.value : [],
    smtSignals: signals.status === 'fulfilled' ? signals.value : [],
    killzones: killzones.status === 'fulfilled' ? killzones.value : null,
    health: health.status === 'fulfilled' ? health.value : null,
    settings: settings.status === 'fulfilled' ? settings.value : null,
    errors: {
      market: market.status === 'rejected' ? market.reason : null,
      signals: signals.status === 'rejected' ? signals.reason : null,
      killzones: killzones.status === 'rejected' ? killzones.reason : null,
      health: health.status === 'rejected' ? health.reason : null,
      settings: settings.status === 'rejected' ? settings.reason : null,
    }
  };
};

// Дополнительные утилиты
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const health = await fetchHealth();
    return health.status === 'healthy';
  } catch {
    return false;
  }
};

export const validateSettings = (settings: Partial<Settings>): string[] => {
  const errors: string[] = [];
  
  if (settings.smt_strength_threshold !== undefined) {
    if (settings.smt_strength_threshold < 0 || settings.smt_strength_threshold > 1) {
      errors.push('SMT Strength Threshold must be between 0 and 1');
    }
  }
  
  if (settings.killzone_priorities !== undefined) {
    if (!Array.isArray(settings.killzone_priorities) || 
        !settings.killzone_priorities.every(p => Number.isInteger(p))) {
      errors.push('Killzone priorities must be array of integers');
    }
  }
  
  if (settings.refresh_interval !== undefined) {
    if (!Number.isInteger(settings.refresh_interval) || settings.refresh_interval < 1000) {
      errors.push('Refresh interval must be at least 1000ms');
    }
  }
  
  if (settings.max_signals_display !== undefined) {
    if (!Number.isInteger(settings.max_signals_display) || settings.max_signals_display < 1) {
      errors.push('Max signals display must be positive integer');
    }
  }
  
  if (settings.divergence_threshold !== undefined) {
    if (settings.divergence_threshold < 0.1 || settings.divergence_threshold > 2.0) {
      errors.push('Divergence threshold must be between 0.1 and 2.0');
    }
  }
  
  if (settings.confirmation_candles !== undefined) {
    if (!Number.isInteger(settings.confirmation_candles) || 
        settings.confirmation_candles < 1 || settings.confirmation_candles > 10) {
      errors.push('Confirmation candles must be between 1 and 10');
    }
  }
  
  if (settings.volume_multiplier !== undefined) {
    if (settings.volume_multiplier < 1.0 || settings.volume_multiplier > 5.0) {
      errors.push('Volume multiplier must be between 1.0 and 5.0');
    }
  }
  
  const timeFields = ['london_open', 'ny_open', 'asia_open'] as const;
  timeFields.forEach(field => {
    const timeValue = settings[field];
    if (timeValue !== undefined) {
      const timeRegex = /^[0-2][0-9]:[0-5][0-9]$/;
      if (!timeRegex.test(timeValue)) {
        errors.push(`${field.replace('_', ' ')} must be in HH:MM format`);
      }
    }
  });
  
  return errors;
};

export { ApiError };