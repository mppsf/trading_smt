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
  SMTAnalysisFilter
} from '../types';

const BASE = 'http://localhost:8000';

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

// Базовая функция для выполнения HTTP запросов с обработкой ошибок
async function apiRequest<T>(
  url: string, 
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorMessage;
      } catch {
        // Если не JSON, используем текст как есть
        errorMessage = errorText || errorMessage;
      }
      
      throw new ApiError(errorMessage, response.status, errorText);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text() as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Обработка сетевых ошибок
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Ошибка сети: сервер недоступен', 0);
    }
    
    throw new ApiError(`Неожиданная ошибка: ${error}`, 0);
  }
}

// Получение рыночных данных согласно бэкенду MarketDataResponse
export async function fetchMarketData(
  symbols: string, 
  timeframe = '5m', 
  limit = 100
): Promise<MarketData[]> {
  const url = `${BASE}/api/v1/market-data?symbols=${symbols}&timeframe=${timeframe}&limit=${limit}`;
  return apiRequest<MarketData[]>(url);
}

// Получение SMT сигналов согласно бэкенду SMTAnalysisResponse
export async function fetchSMTSignals(
  limit = 50,
  filter?: SMTAnalysisFilter
): Promise<SMTAnalysisResponse> {
  let url = `${BASE}/api/v1/smt-signals?limit=${limit}`;
  
  if (filter) {
    const params = new URLSearchParams();
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
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
  }
  
  return apiRequest<SMTAnalysisResponse>(url);
}

// Получение killzones согласно бэкенду
export async function fetchKillzones(): Promise<KillzonesResponse> {
  const url = `${BASE}/api/v1/killzones`;
  return apiRequest<KillzonesResponse>(url);
}

// Получение health статуса согласно бэкенду HealthResponse
export async function fetchHealth(): Promise<HealthStatus> {
  const url = `${BASE}/health`;
  return apiRequest<HealthStatus>(url);
}

// Получение True Opens согласно бэкенду
export async function fetchTrueOpens(): Promise<TrueOpensResponse> {
  const url = `${BASE}/api/v1/true-opens`;
  return apiRequest<TrueOpensResponse>(url);
}

// Получение фракталов согласно бэкенду
export async function fetchFractals(symbol: string, limit = 50): Promise<FractalsResponse> {
  const url = `${BASE}/api/v1/fractals?symbol=${symbol}&limit=${limit}`;
  return apiRequest<FractalsResponse>(url);
}

// Получение аномалий объема согласно бэкенду
export async function fetchVolumeAnomalies(
  symbol: string, 
  limit = 50
): Promise<VolumeAnomalyResponse[]> {
  const url = `${BASE}/api/v1/volume-anomalies?symbol=${symbol}&limit=${limit}`;
  return apiRequest<VolumeAnomalyResponse[]>(url);
}

// Получение статистики анализа согласно бэкенду
export async function fetchAnalysisStats(): Promise<AnalysisStatsResponse> {
  const url = `${BASE}/api/v1/analysis-stats`;
  return apiRequest<AnalysisStatsResponse>(url);
}

// Настройки (пока не определены в бэкенде, но используются в коде)
export async function fetchSettings(): Promise<Settings> {
  const url = `${BASE}/api/v1/settings`;
  return apiRequest<Settings>(url);
}

export async function updateSettings(payload: Partial<Settings>): Promise<Settings> {
  const url = `${BASE}/api/v1/settings`;
  return apiRequest<Settings>(url, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Дополнительные утилиты для работы с API

// Проверка доступности API
export async function checkApiHealth(): Promise<boolean> {
  try {
    await fetchHealth();
    return true;
  } catch {
    return false;
  }
}

// Batch запрос для получения всех данных разом
export async function fetchAllData(): Promise<{
  marketData: MarketData[];
  smtAnalysis: SMTAnalysisResponse;
  killzones: KillzonesResponse;
  trueOpens: TrueOpensResponse;
  health: HealthStatus;
  analysisStats: AnalysisStatsResponse;
}> {
  try {
    const [
      marketData, 
      smtAnalysis, 
      killzones, 
      trueOpens,
      health,
      analysisStats
    ] = await Promise.allSettled([
      fetchMarketData('QQQ,SPY'),
      fetchSMTSignals(),
      fetchKillzones(),
      fetchTrueOpens(),
      fetchHealth(),
      fetchAnalysisStats()
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
      }
    };
  } catch (error) {
    console.error('Error fetching all data:', error);
    throw error;
  }
}

// Хелпер для получения только сигналов (для обратной совместимости)
export async function fetchSMTSignalsLegacy(limit = 50): Promise<SMTSignal[]> {
  const response = await fetchSMTSignals(limit);
  return response.signals;
}

// Хелпер для получения текущей активной killzone
export async function fetchCurrentKillzone(): Promise<KillzoneInfo | null> {
  try {
    const response = await fetchKillzones();
    return response.killzones.find(kz => kz.is_active) || response.killzones[0] || null;
  } catch (error) {
    console.warn('Error fetching current killzone:', error);
    return null;
  }
}

// Экспорт класса ошибки для использования в компонентах
export { ApiError };