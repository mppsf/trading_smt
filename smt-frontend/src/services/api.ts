// src/services/api.ts
import { 
  MarketData, 
  SMTSignal, 
  SMTAnalysisResponse,
  KillzonesResponse,
  KillzoneInfo,
  HealthStatus, 
  Settings,
  TrueOpensResponse,
  FractalsResponse,
  VolumeAnomalyResponse,
  AnalysisStatsResponse,
  SMTAnalysisFilter,
  ApiResponse
} from '../types';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Централизованная обработка ошибок API
class ApiError extends Error {
  constructor(
    message: string, 
    public status: number, 
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Базовая функция для выполнения HTTP запросов
async function apiRequest<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      
      throw new ApiError(errorMessage, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text() as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Обработка сетевых ошибок
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Сервер недоступен. Проверьте подключение к интернету.', 0);
    }
    
    throw new ApiError(`Неожиданная ошибка: ${error}`, 0);
  }
}

// ===========================================
// Market Data API
// ===========================================

export async function fetchMarketData(
  symbols: string = 'QQQ,SPY', 
  timeframe: string = '5m', 
  limit: number = 100
): Promise<MarketData[]> {
  const params = new URLSearchParams({
    symbols,
    timeframe,
    limit: limit.toString()
  });
  
  return apiRequest<MarketData[]>(`/api/v1/market-data?${params}`);
}

// ===========================================
// SMT Analysis API
// ===========================================

export async function fetchSMTSignals(
  limit: number = 50,
  filter?: SMTAnalysisFilter
): Promise<SMTAnalysisResponse> {
  const params = new URLSearchParams({
    limit: limit.toString()
  });
  
  if (filter) {
    if (filter.signal_types?.length) {
      params.append('signal_types', filter.signal_types.join(','));
    }
    if (filter.min_strength !== undefined) {
      params.append('min_strength', filter.min_strength.toString());
    }
    if (filter.confirmed_only !== undefined) {
      params.append('confirmed_only', filter.confirmed_only.toString());
    }
    if (filter.time_from) {
      params.append('time_from', filter.time_from);
    }
    if (filter.time_to) {
      params.append('time_to', filter.time_to);
    }
  }
  
  return apiRequest<SMTAnalysisResponse>(`/api/v1/smt-analysis?${params}`);
}

// Backwards compatibility - возвращает только массив сигналов
export async function fetchSMTSignalsLegacy(limit: number = 50): Promise<SMTSignal[]> {
  const response = await fetchSMTSignals(limit);
  return response.signals;
}

// ===========================================
// Killzones API
// ===========================================

export async function fetchKillzones(): Promise<KillzonesResponse> {
  return apiRequest<KillzonesResponse>('/api/v1/killzones');
}

export async function fetchCurrentKillzone(): Promise<KillzoneInfo | null> {
  try {
    const response = await fetchKillzones();
    return response.current_session || 
           response.killzones.find(kz => kz.is_active) || 
           null;
  } catch (error) {
    console.warn('Error fetching current killzone:', error);
    return null;
  }
}

// ===========================================
// True Opens API
// ===========================================

export async function fetchTrueOpens(): Promise<TrueOpensResponse> {
  return apiRequest<TrueOpensResponse>('/api/v1/true-opens');
}

// ===========================================
// Fractals API
// ===========================================

export async function fetchFractals(
  symbol: string, 
  limit: number = 50,
  timeframe: string = '5m'
): Promise<FractalsResponse> {
  const params = new URLSearchParams({
    symbol,
    limit: limit.toString(),
    timeframe
  });
  
  return apiRequest<FractalsResponse>(`/api/v1/fractals?${params}`);
}

// ===========================================
// Volume Anomalies API
// ===========================================

export async function fetchVolumeAnomalies(
  symbol: string, 
  limit: number = 50
): Promise<VolumeAnomalyResponse[]> {
  const params = new URLSearchParams({
    symbol,
    limit: limit.toString()
  });
  
  return apiRequest<VolumeAnomalyResponse[]>(`/api/v1/volume-anomalies?${params}`);
}

// ===========================================
// Analysis Stats API
// ===========================================

export async function fetchAnalysisStats(): Promise<AnalysisStatsResponse> {
  return apiRequest<AnalysisStatsResponse>('/api/v1/analysis-stats');
}

// ===========================================
// Health Check API
// ===========================================

export async function fetchHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>('/health');
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const health = await fetchHealth();
    return health.status === 'healthy';
  } catch {
    return false;
  }
}

// ===========================================
// Settings API (если будет реализован в бэкенде)
// ===========================================

export async function fetchSettings(): Promise<Settings> {
  // Временная заглушка до реализации в бэкенде
  return Promise.resolve({
    smt_strength_threshold: 0.7,
    killzone_priorities: [1, 2, 3],
    refresh_interval: 30000,
    max_signals_display: 50,
    enable_notifications: true,
    chart_timeframes: ['1m', '5m', '15m', '1h']
  });
}

export async function updateSettings(payload: Partial<Settings>): Promise<Settings> {
  // Временная заглушка до реализации в бэкенде
  console.log('Settings update requested:', payload);
  return fetchSettings();
}

// ===========================================
// Batch Operations
// ===========================================

export async function fetchAllData(): Promise<{
  marketData: MarketData[];
  smtAnalysis: SMTAnalysisResponse;
  killzones: KillzonesResponse;
  trueOpens: TrueOpensResponse;
  health: HealthStatus;
  analysisStats: AnalysisStatsResponse;
  settings: Settings;
}> {
  try {
    const [
      marketData, 
      smtAnalysis, 
      killzones, 
      trueOpens,
      health,
      analysisStats,
      settings
    ] = await Promise.allSettled([
      fetchMarketData('QQQ,SPY'),
      fetchSMTSignals(50),
      fetchKillzones(),
      fetchTrueOpens(),
      fetchHealth(),
      fetchAnalysisStats(),
      fetchSettings()
    ]);

    return {
      marketData: marketData.status === 'fulfilled' ? marketData.value : [],
      smtAnalysis: smtAnalysis.status === 'fulfilled' ? smtAnalysis.value : {
        signals: [],
        total_count: 0,
        analysis_timestamp: new Date().toISOString(),
        market_phase: null
      },
      killzones: killzones.status === 'fulfilled' ? killzones.value : {
        killzones: []
      },
      trueOpens: trueOpens.status === 'fulfilled' ? trueOpens.value : {
        es_opens: { timestamp: new Date().toISOString() },
        nq_opens: { timestamp: new Date().toISOString() }
      },
      health: health.status === 'fulfilled' ? health.value : {
        status: "unknown",
        redis: "offline",
        timestamp: new Date().toISOString()
      },
      analysisStats: analysisStats.status === 'fulfilled' ? analysisStats.value : {
        total_signals: 0,
        confirmed_signals: 0,
        signal_distribution: {},
        avg_strength: 0,
        last_analysis: new Date().toISOString()
      },
      settings: settings.status === 'fulfilled' ? settings.value : {
        smt_strength_threshold: 0.7,
        killzone_priorities: [1, 2, 3],
        refresh_interval: 30000,
        max_signals_display: 50,
        enable_notifications: true,
        chart_timeframes: ['1m', '5m', '15m', '1h']
      }
    };
  } catch (error) {
    console.error('Error fetching all data:', error);
    throw error;
  }
}

// ===========================================
// Utility Functions
// ===========================================

export function createApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  const url = new URL(endpoint, BASE_URL);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }
  
  return url.toString();
}

// WebSocket URL helper
export function getWebSocketUrl(): string {
  const wsProtocol = BASE_URL.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = BASE_URL.replace(/^https?/, wsProtocol);
  return `${wsUrl}/ws`;
}

// Экспорт класса ошибки
export { ApiError };

// ===========================================
// Type Guards (для проверки типов во время выполнения)
// ===========================================

export function isMarketData(obj: any): obj is MarketData {
  return obj && typeof obj.symbol === 'string' && typeof obj.current_price === 'number';
}

export function isSMTSignal(obj: any): obj is SMTSignal {
  return obj && typeof obj.id === 'string' && typeof obj.signal_type === 'string';
}

export function isHealthStatus(obj: any): obj is HealthStatus {
  return obj && typeof obj.status === 'string' && typeof obj.redis === 'string';
}