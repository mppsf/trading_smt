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
  current_price: number;
  change_percent: number;
  volume: number;
  timestamp: string;
  ohlcv_5m: OHLCV[];
  // Добавляем поле market_state которое возвращает бэкенд
  market_state?: string;
}

export interface SMTSignal {
  timestamp: string;
  signal_type: 'bullish_divergence' | 'bearish_divergence' | 'neutral';
  strength: number;
  nasdaq_price: number;
  sp500_price: number;
  divergence_percentage: number;
  confirmation_status: boolean;
  // Добавляем поле details которое возвращает бэкенд
  details?: any;
}

export interface KillzoneInfo {
  current: string | null;
  time_remaining: string;
  next_session: string;
  priority: 'high' | 'medium' | 'low';
}

// Приводим в соответствие с бэкендом
export interface HealthStatus {
  redis: string;
}

// Расширяем настройки согласно бэкенду
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

// Тип для фильтрации SMT сигналов
export interface SMTSignalFilter {
  signal_type?: SMTSignal['signal_type'];
  min_strength?: number;
  max_strength?: number;
  date_from?: string;
  date_to?: string;
  confirmation_only?: boolean;
}

// Тип для пагинации
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Расширенный тип рыночных данных с техническими индикаторами
export interface EnhancedMarketData extends MarketData {
  technical_indicators?: {
    rsi?: number;
    sma_20?: number;
    ema_20?: number;
    volume_sma?: number;
    atr?: number;
  };
  support_resistance?: {
    support_levels: number[];
    resistance_levels: number[];
  };
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