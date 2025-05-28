// src/types.ts

export interface OHLCVData {
  timestamp: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface MarketData {
  symbol: string;
  current_price: number;
  change_percent: number;
  volume: number;
  timestamp: string;
  ohlcv: OHLCVData[];
  market_state: string;
}

export interface SMTSignal {
  timestamp: string;
  signal_type: string;
  strength: number;
  nasdaq_price: number;
  sp500_price: number;
  divergence_percentage: number;
  confirmation_status: boolean;
  details: Record<string, any>;
}

export interface SMTAnalysisResponse {
  signals: SMTSignal[];
  total_count: number;
  analysis_timestamp: string;
  market_phase: string | null;
}

export interface KillzoneInfo {
  killzones: Array<{
    name: string;
    start_time: string;
    end_time: string;
    priority: number;
    active: boolean;
  }>;
}

export interface HealthStatus {
  status: string;
  redis: string;
  timestamp: string;
}

// Исправленный интерфейс настроек с соответствием бэкенду
export interface Settings {
  // Основные настройки
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  
  // Дополнительные параметры SMT
  divergence_threshold: number;
  confirmation_candles: number;
  volume_multiplier: number;
  
  // Настройки времени торговых сессий
  london_open: string;
  ny_open: string;
  asia_open: string;
}

// Тип для частичного обновления настроек
export interface SettingsUpdateRequest {
  smt_strength_threshold?: number;
  killzone_priorities?: number[];
  refresh_interval?: number;
  max_signals_display?: number;
  divergence_threshold?: number;
  confirmation_candles?: number;
  volume_multiplier?: number;
  london_open?: string;
  ny_open?: string;
  asia_open?: string;
}

// Ответ API при получении данных
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

// Дополнительные типы для валидации
export interface SettingsValidationRules {
  smt_strength_threshold: { min: number; max: number };
  killzone_priorities: { validValues: number[] };
  refresh_interval: { min: number };
  max_signals_display: { min: number; max: number };
  divergence_threshold: { min: number; max: number };
  confirmation_candles: { min: number; max: number };
  volume_multiplier: { min: number; max: number };
}

// Константы для валидации
export const SETTINGS_VALIDATION: SettingsValidationRules = {
  smt_strength_threshold: { min: 0.0, max: 1.0 },
  killzone_priorities: { validValues: [1, 2, 3, 4, 5] },
  refresh_interval: { min: 1000 },
  max_signals_display: { min: 1, max: 100 },
  divergence_threshold: { min: 0.1, max: 2.0 },
  confirmation_candles: { min: 1, max: 10 },
  volume_multiplier: { min: 1.0, max: 5.0 }
};

// Дефолтные настройки
export const DEFAULT_SETTINGS: Settings = {
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

// Enum для типов сигналов
export enum SMTSignalType {
  BULLISH_DIVERGENCE = "bullish_divergence",
  BEARISH_DIVERGENCE = "bearish_divergence",
  FALSE_BREAK = "false_break",
  VOLUME_ANOMALY = "volume_anomaly",
  JUDAS_SWING = "judas_swing"
}

// Тип для статуса сохранения настроек
export interface SettingsSaveStatus {
  saving: boolean;
  error: string;
  success: boolean;
}