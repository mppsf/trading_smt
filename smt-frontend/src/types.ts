// src/types.ts
export interface OHLCV {
  timestamp: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface MarketData {
  symbol: string;
  price: number; // Изменено с current_price на price (как в бэкенде)
  volume?: number; // Сделано опциональным как в бэкенде
  timestamp: string;
  // Убираем поля которых нет в бэкенде
  // change_percent: number;
  // ohlcv_5m: OHLCV[];
  // market_state?: string;
}

// Приводим в соответствие с бэкендом SMTSignalResponse
export interface SMTSignal {
  timestamp: string;
  signal_type: string; // Изменено на string как в бэкенде
  strength: number; // от 0 до 1
  nasdaq_price: number;
  sp500_price: number;
  divergence_percentage: number;
  confirmation_status: boolean;
  details: Record<string, any>; // Изменено с any на Record для лучшей типизации
}

// Приводим в соответствие с бэкендом KillzoneInfo
export interface KillzoneInfo {
  name: string;
  start_time: string;
  end_time: string;
  description?: string;
  is_active?: boolean;
  timezone?: string;
}

// Ответ для killzones согласно бэкенду
export interface KillzonesResponse {
  killzones: KillzoneInfo[];
}

// Приводим в соответствие с бэкендом HealthResponse
export interface HealthStatus {
  status: string;
  redis: string;
  timestamp: string;
}

// Расширяем настройки согласно бэкенду (пока нет в схемах, но используется в API)
export interface Settings {
  min_divergence_threshold: number;
  lookback_period: number;
  swing_threshold: number;
  lookback_swings: number;
  min_block_size: number;
  volume_threshold: number;
  min_fvg_gap_size: number;
  quarterly_months: number[];
  monthly_bias_days: number[];
}

// Добавляем типы согласно бэкенду
export interface SMTAnalysisResponse {
  signals: SMTSignal[];
  total_count: number;
  analysis_timestamp: string;
  market_phase?: string;
}

export interface TrueOpenResponse {
  daily?: number;
  weekly?: number;
  quarterly?: number;
  timestamp: string;
}

export interface TrueOpensResponse {
  es_opens: TrueOpenResponse;
  nq_opens: TrueOpenResponse;
}

export interface FractalPoint {
  timestamp: string;
  price: number;
  type: string; // 'high' or 'low'
  index: number;
}

export interface FractalsResponse {
  symbol: string;
  high_fractals: FractalPoint[];
  low_fractals: FractalPoint[];
  timestamp: string;
}

export interface VolumeAnomalyResponse {
  timestamp: string;
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  anomaly_type: string;
  significance: number;
}

// Перечисления типов сигналов как в бэкенде
export const SMTSignalType = {
  SMT_BULLISH_DIVERGENCE: "smt_bullish_divergence",
  SMT_BEARISH_DIVERGENCE: "smt_bearish_divergence",
  FALSE_BREAK_UP: "false_break_up",
  FALSE_BREAK_DOWN: "false_break_down",
  VOLUME_SPIKE: "volume_spike",
  VOLUME_DIVERGENCE_BULLISH: "volume_divergence_bullish",
  VOLUME_DIVERGENCE_BEARISH: "volume_divergence_bearish",
  JUDAS_SWING_BULLISH: "judas_swing_bullish",
  JUDAS_SWING_BEARISH: "judas_swing_bearish"
} as const;

export type SMTSignalTypeValue = typeof SMTSignalType[keyof typeof SMTSignalType];

// Фильтры согласно бэкенду
export interface SMTAnalysisFilter {
  signal_types?: SMTSignalTypeValue[];
  min_strength?: number; // от 0 до 1
  confirmed_only?: boolean;
  time_from?: string; // ISO datetime string
  time_to?: string; // ISO datetime string
}

export interface AnalysisStatsResponse {
  total_signals: number;
  confirmed_signals: number;
  signal_distribution: Record<string, number>;
  avg_strength: number;
  last_analysis: string;
}

// Дополнительные типы для улучшенной работы с API

// Тип для состояния загрузки
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  lastUpdated?: string;
}

// Тип для WebSocket сообщений
export interface WebSocketMessage {
  type: 'market_update' | 'smt_signal' | 'system_status';
  data: any;
  timestamp: string;
}

// Тип для статуса соединения
export interface ConnectionStatus {
  api: 'connected' | 'disconnected' | 'error';
  websocket: 'connected' | 'disconnected' | 'error';
  redis: 'connected' | 'disconnected' | 'unknown';
}

// Расширенный тип настроек с метаданными
export interface SettingsWithMeta extends Settings {
  _metadata?: {
    lastUpdated: string;
    version: string;
    source: 'api' | 'local' | 'default';
  };
}

// Тип для batch операций
export interface BatchResponse<T> {
  data?: T;
  error?: string;
  status: 'success' | 'error' | 'partial';
}

// Типы для различных состояний компонентов
export interface ComponentState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch?: Date;
}

// Тип для системных уведомлений
export interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

// Тип для конфигурации Chart компонентов
export interface ChartConfig {
  symbol: string;
  timeframe: string;
  indicators: string[];
  theme: 'light' | 'dark';
  height: number;
  showVolume: boolean;
  showGrid: boolean;
}

// Тип для пагинации
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Тип для экспорта данных
export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  data_type: 'market_data' | 'smt_signals' | 'all';
  date_range?: {
    from: string;
    to: string;
  };
  symbols?: string[];
}