// src/services/api.ts
import { 
  MarketData, 
  SMTSignal, 
  SMTAnalysisResponse,
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

// ИСПРАВЛЕНО: Теперь правильно обрабатываем ответ SMTAnalysisResponse
export const fetchSMTSignals = async (): Promise<SMTSignal[]> => {
  try {
    const response = await apiRequest<SMTAnalysisResponse>(`${BASE}/api/v1/smt-signals`);
    
    // Бэкенд возвращает объект SMTAnalysisResponse с полем signals
    if (response && Array.isArray(response.signals)) {
      return response.signals;
    }
    
    // Если структура неожиданная, проверяем является ли сам ответ массивом
    if (Array.isArray(response)) {
      return response as SMTSignal[];
    }
    
    console.warn('Unexpected SMT signals response structure:', response);
    return [];
  } catch (error) {
    console.error('Failed to fetch SMT signals:', error);
    return [];
  }
};

export const fetchKillzones = async (): Promise<KillzoneInfo | null> => {
  try {
    const data = await apiRequest<KillzoneInfo>(`${BASE}/api/v1/killzones`);
    return data;
  } catch (error) {
    console.error('Failed to fetch killzones:', error);
    return null;
  }
};

export const fetchHealth = async (): Promise<HealthStatus | null> => {
  try {
    const data = await apiRequest<HealthStatus>(`${BASE}/health`);
    return data;
  } catch (error) {
    console.error('Failed to fetch health status:', error);
    return null;
  }
};

export const fetchSettings = async (): Promise<Settings> => {
  try {
    const data = await apiRequest<Settings>(`${BASE}/api/v1/settings`);
    
    // Проверяем, что все обязательные поля присутствуют
    const requiredFields = [
      'smt_strength_threshold', 
      'killzone_priorities', 
      'refresh_interval', 
      'max_signals_display'
    ];
    
    const hasAllRequired = requiredFields.every(field => 
      data && typeof data[field as keyof Settings] !== 'undefined'
    );
    
    if (!hasAllRequired) {
      throw new Error('Invalid settings response: missing required fields');
    }
    
    // Возвращаем данные с дефолтными значениями для дополнительных полей
    const defaultSettings: Settings = {
      smt_strength_threshold: 0.7,
      killzone_priorities: [1, 2, 3],
      refresh_interval: 30000,
      max_signals_display: 10,
      divergence_threshold: 0.5,
      confirmation_candles: 3,
      volume_multiplier: 1.5,
      london_open: "08:00",
      ny_open: "13:30",
      asia_open: "00:00"
    };
    
    return { ...defaultSettings, ...data };
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    // Возвращаем дефолтные настройки при ошибке
    return {
      smt_strength_threshold: 0.7,
      killzone_priorities: [1, 2, 3],
      refresh_interval: 30000,
      max_signals_display: 10,
      divergence_threshold: 0.5,
      confirmation_candles: 3,
      volume_multiplier: 1.5,
      london_open: "08:00",
      ny_open: "13:30",
      asia_open: "00:00"
    };
  }
};

export const updateSettings = async (payload: Partial<Settings>): Promise<Settings> => {
  try {
    // Фильтруем пустые значения
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    if (Object.keys(cleanPayload).length === 0) {
      throw new Error('No valid settings to update');
    }
    
    const data = await apiRequest<Settings>(`${BASE}/api/v1/settings`, {
      method: 'PUT',
      body: JSON.stringify(cleanPayload),
    });
    
    return data;
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
};

// УЛУЧШЕННАЯ версия fetchAllData с лучшей обработкой ошибок
export const fetchAllData = async () => {
  const [market, signals, killzone, health, settings] = await Promise.allSettled([
    fetchMarketData('ES=F,NQ=F'), // Используем правильные символы для фьючерсов
    fetchSMTSignals(),
    fetchKillzones(),
    fetchHealth(),
    fetchSettings()
  ]);

  return {
    marketData: market.status === 'fulfilled' ? market.value : [],
    smtSignals: signals.status === 'fulfilled' ? signals.value : [],
    killzones: killzone.status === 'fulfilled' ? killzone.value : null,
    health: health.status === 'fulfilled' ? health.value : null,
    settings: settings.status === 'fulfilled' ? settings.value : null,
    errors: {
      market: market.status === 'rejected' ? market.reason : null,
      signals: signals.status === 'rejected' ? signals.reason : null,
      killzone: killzone.status === 'rejected' ? killzone.reason : null,
      health: health.status === 'rejected' ? health.reason : null,
      settings: settings.status === 'rejected' ? settings.reason : null,
    }
  };
};

// Вспомогательные функции для работы с API

// Проверка доступности API
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const health = await fetchHealth();
    return health?.status === 'healthy';
  } catch {
    return false;
  }
};

// Валидация настроек перед отправкой
export const validateSettings = (settings: Partial<Settings>): string[] => {
  const errors: string[] = [];
  
  if (settings.smt_strength_threshold !== undefined) {
    if (settings.smt_strength_threshold < 0 || settings.smt_strength_threshold > 1) {
      errors.push('SMT Strength Threshold must be between 0 and 1');
    }
  }
  
  if (settings.killzone_priorities !== undefined) {
    if (!Array.isArray(settings.killzone_priorities) || 
        !settings.killzone_priorities.every(p => Number.isInteger(p) && p >= 1 && p <= 5)) {
      errors.push('Killzone priorities must be integers between 1 and 5');
    }
  }
  
  if (settings.refresh_interval !== undefined) {
    if (!Number.isInteger(settings.refresh_interval) || settings.refresh_interval < 1000) {
      errors.push('Refresh interval must be at least 1000ms');
    }
  }
  
  if (settings.max_signals_display !== undefined) {
    if (!Number.isInteger(settings.max_signals_display) || 
        settings.max_signals_display < 1 || settings.max_signals_display > 100) {
      errors.push('Max signals display must be between 1 and 100');
    }
  }
  
  // Проверка времени
  const timeFields = ['london_open', 'ny_open', 'asia_open'] as const;
  timeFields.forEach(field => {
    const timeValue = settings[field];
    if (timeValue !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(timeValue)) {
        errors.push(`${field.replace('_', ' ')} must be in HH:MM format`);
      }
    }
  });
  
  return errors;
};

export { ApiError };