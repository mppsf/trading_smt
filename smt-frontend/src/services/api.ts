// src/services/api.ts - Оптимизированная версия
import { 
  MarketData, 
  SMTSignal,
  SMTAnalysisResponse,
  KillzoneInfo,
  HealthStatus, 
  Settings,
  ErrorResponse
} from '../types';

const BASE = 'http://localhost:8000';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Единая функция для API запросов
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

// Универсальный билдер параметров
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  });
  return searchParams.toString();
}

// Кэширование настроек для избежания лишних запросов
let cachedSettings: Settings | null = null;
let settingsTimestamp = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 минута

export const fetchSettings = async (forceRefresh = false): Promise<Settings> => {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && (now - settingsTimestamp) < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }
  
  cachedSettings = await apiRequest<Settings>(`${BASE}/api/v1/settings`);
  settingsTimestamp = now;
  return cachedSettings;
};

export const updateSettings = async (payload: Partial<Settings>): Promise<Settings> => {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined && value !== null)
  );
  
  if (Object.keys(cleanPayload).length === 0) {
    throw new Error('No valid settings to update');
  }
  
  const result = await apiRequest<Settings>(`${BASE}/api/v1/settings`, {
    method: 'PUT',
    body: JSON.stringify(cleanPayload),
  });
  
  // Обновляем кэш
  cachedSettings = result;
  settingsTimestamp = Date.now();
  
  return result;
};

// Оптимизированная функция получения сигналов с полными параметрами
export const fetchSMTSignals = async (overrideParams: Record<string, any> = {}): Promise<SMTSignal[]> => {
  try {
    const settings = await fetchSettings();
    
    // Маппинг всех доступных параметров из настроек
    const fullParams = {
      // Основные параметры
      limit: settings.max_signals_display || 50,
      min_strength: settings.smt_strength_threshold || 0.6,
      
      // Расширенные параметры фильтрации
      divergence_threshold: settings.divergence_threshold || 2.0,
      confirmation_candles: settings.confirmation_candles || 3,
      volume_multiplier: settings.volume_multiplier || 1.5,
      
      // Приоритеты killzone (если массив, берем первый элемент как минимальный приоритет)
      min_killzone_priority: Array.isArray(settings.killzone_priorities) 
        ? Math.min(...settings.killzone_priorities) 
        : settings.killzone_priorities || 1,
      
      // Интервал обновления влияет на фильтрацию по времени
      time_window_minutes: Math.floor((settings.refresh_interval || 30000) / 1000 / 60),
      
      // Переопределяющие параметры имеют приоритет
      ...overrideParams
    };
    
    const queryString = buildQueryString(fullParams);
    const url = `${BASE}/api/v1/smt-signals?${queryString}`;
    
    console.log('SMT Signals request with full params:', fullParams);
    
    const response = await apiRequest<SMTAnalysisResponse>(url);
    return response.signals || [];
  } catch (error) {
    console.error('Error fetching SMT signals:', error);
    return [];
  }
};

// Остальные функции без изменений, но с оптимизацией
export const fetchHealth = async (): Promise<HealthStatus> => {
  return apiRequest<HealthStatus>(`${BASE}/health`);
};

export const fetchMarketData = async (symbols = 'QQQ,SPY'): Promise<MarketData[]> => {
  const params = { symbols, timeframe: '5m', limit: 100 };
  const queryString = buildQueryString(params);
  return apiRequest<MarketData[]>(`${BASE}/api/v1/market-data?${queryString}`);
};

export const fetchKillzones = async (): Promise<KillzoneInfo | null> => {
  try {
    const response = await apiRequest<any>(`${BASE}/api/v1/killzones`);
    
    if (!response?.killzones?.length) return null;
    
    const active = response.killzones.find((k: any) => k.is_active);
    const inactive = response.killzones.filter((k: any) => !k.is_active);
    
    return {
      current: active?.name || null,
      priority: active ? 'high' : 'low',
      time_remaining: active ? 'Active' : 'None',
      next_session: inactive[0]?.name || 'Unknown'
    };
  } catch (error) {
    console.error('Error fetching killzones:', error);
    return null;
  }
};

export { ApiError };