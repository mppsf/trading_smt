// src/services/api.ts
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus, Settings } from '../types';

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

export async function fetchMarketData(
  symbols: string, 
  timeframe = '5m', 
  limit = 100
): Promise<MarketData[]> {
  const url = `${BASE}/api/v1/market-data?symbols=${symbols}&timeframe=${timeframe}&limit=${limit}`;
  return apiRequest<MarketData[]>(url);
}

export async function fetchSMTSignals(limit = 50): Promise<SMTSignal[]> {
  const url = `${BASE}/api/v1/smt-signals?limit=${limit}`;
  return apiRequest<SMTSignal[]>(url);
}

// Адаптируем под структуру бэкенда
export async function fetchKillzones(): Promise<KillzoneInfo> {
  const url = `${BASE}/api/v1/killzones`;
  
  try {
    const response = await apiRequest<{ killzones: any[] }>(url);
    
    // Адаптируем ответ бэкенда под ожидаемую структуру фронтенда
    if (response.killzones && response.killzones.length > 0) {
      const currentKillzone = response.killzones[0]; // Берем первую зону как текущую
      
      return {
        current: currentKillzone.name || null,
        time_remaining: currentKillzone.time_remaining || "00:00:00",
        next_session: currentKillzone.next_session || "Unknown",
        priority: currentKillzone.priority || "medium"
      };
    }
    
    // Fallback если нет данных
    return {
      current: null,
      time_remaining: "00:00:00",
      next_session: "Unknown",
      priority: "low" as const
    };
  } catch (error) {
    console.warn('Killzones API not available, using fallback data');
    return {
      current: null,
      time_remaining: "00:00:00", 
      next_session: "Market Closed",
      priority: "low" as const
    };
  }
}

// Адаптируем под структуру бэкенда
export async function fetchHealth(): Promise<HealthStatus> {
  const url = `${BASE}/health`;
  
  try {
    const response = await apiRequest<{
      status: string;
      redis: string;
      timestamp: string;
    }>(url);
    
    // Адаптируем под ожидаемую структуру фронтенда
    return {
      redis: response.redis || response.status || "unknown"
    };
  } catch (error) {
    return {
      redis: "offline"
    };
  }
}

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
  smtSignals: SMTSignal[];
  killzones: KillzoneInfo;
  settings: Settings;
  health: HealthStatus;
}> {
  try {
    const [marketData, smtSignals, killzones, settings, health] = await Promise.allSettled([
      fetchMarketData('QQQ,SPY'),
      fetchSMTSignals(),
      fetchKillzones(),
      fetchSettings(),
      fetchHealth()
    ]);

    return {
      marketData: marketData.status === 'fulfilled' ? marketData.value : [],
      smtSignals: smtSignals.status === 'fulfilled' ? smtSignals.value : [],
      killzones: killzones.status === 'fulfilled' ? killzones.value : {
        current: null,
        time_remaining: "00:00:00",
        next_session: "Unknown",
        priority: "low" as const
      },
      settings: settings.status === 'fulfilled' ? settings.value : {
        min_divergence_threshold: 0.5,
        lookback_period: 20,
        swing_threshold: 0.02,
        lookback_swings: 5,
        min_block_size: 100000,
        volume_threshold: 1000000,
        min_fvg_gap_size: 0.001,
        quarterly_months: [3, 6, 9, 12],
        monthly_bias_days: [1, 2, 3, 15, 16, 17]
      },
      health: health.status === 'fulfilled' ? health.value : { redis: "offline" }
    };
  } catch (error) {
    console.error('Error fetching all data:', error);
    throw error;
  }
}

// Экспорт класса ошибки для использования в компонентах
export { ApiError };