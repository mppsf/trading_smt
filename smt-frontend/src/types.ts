// src/types/index.ts
// Базовые типы данных согласно бэкенду

// Market Data Types
export interface MarketData {
  symbol: string;
  current_price: number;
  change_percent: number;
  volume?: number;
  timestamp: string;
  market_state?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

// SMT Signal Types
export interface SMTSignal {
  id: string;
  timestamp: string;
  signal_type: 'bullish_divergence' | 'bearish_divergence' | 'neutral';
  strength: number; // 0-1
  divergence_percentage: number;
  nasdaq_price: number;
  sp500_price: number;
  confirmation_status: boolean;
  details?: Record<string, any>;
  market_phase?: string;
}

export interface SMTAnalysisResponse {
  signals: SMTSignal[];
  total_count: number;
  analysis_timestamp: string;
  market_phase: string | null;
  summary?: {
    bullish_count: number;
    bearish_count: number;
    avg_strength: number;
    confirmed_signals: number;
  };
}

export interface SMTAnalysisFilter {
  signal_types?: string[];
  min_strength?: number;
  confirmed_only?: boolean;
  time_from?: string;
  time_to?: string;
}

// Killzone Types
export interface KillzoneInfo {
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  priority: 'high' | 'medium' | 'low';
  description?: string;
  time_remaining?: string;
  next_session?: string;
}

export interface KillzonesResponse {
  killzones: KillzoneInfo[];
  current_session?: KillzoneInfo;
  next_session?: KillzoneInfo;
}

// True Opens Types
export interface TrueOpenData {
  timestamp: string;
  price?: number;
  identified?: boolean;
  confirmation_candles?: number;
}

export interface TrueOpensResponse {
  es_opens: TrueOpenData;
  nq_opens: TrueOpenData;
  analysis_timestamp?: string;
}

// Fractals Types
export interface FractalPoint {
  timestamp: string;
  price: number;
  type: 'high' | 'low';
  strength: number;
  confirmed: boolean;
}

export interface FractalsResponse {
  fractals: FractalPoint[];
  symbol: string;
  timeframe: string;
  total_count: number;
}

// Volume Anomaly Types
export interface VolumeAnomalyResponse {
  timestamp: string;
  symbol: string;
  volume: number;
  avg_volume: number;
  anomaly_ratio: number;
  severity: 'low' | 'medium' | 'high';
  price_impact?: number;
}

// Analysis Stats Types
export interface AnalysisStatsResponse {
  total_signals: number;
  confirmed_signals: number;
  signal_distribution: Record<string, number>;
  avg_strength: number;
  last_analysis: string;
  performance_metrics?: {
    accuracy?: number;
    profit_factor?: number;
    win_rate?: number;
  };
}

// Health Status Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  redis: 'healthy' | 'offline' | 'error';
  timestamp: string;
  details?: Record<string, any>;
  uptime?: number;
}

// Settings Types (для конфигурации фронтенда)
export interface Settings {
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  enable_notifications: boolean;
  chart_timeframes: string[];
  [key: string]: number | number[] | boolean | string[];
}

// UI State Types
export interface DashboardState {
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

// Notification Types
export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// Chart Types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  volume?: number;
  metadata?: Record<string, any>;
}

export interface ChartConfig {
  timeframe: string;
  indicator_types: string[];
  show_volume: boolean;
  show_signals: boolean;
}

// Filter and Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface FilterParams {
  search?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'market_data' | 'smt_signal' | 'killzone_update' | 'health_update';
  data: any;
  timestamp: string;
}

// API Response Wrapper
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
}

// Error Types
export interface ApiError {
  message: string;
  status: number;
  details?: Record<string, any>;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  loading?: boolean;
  error?: string | null;
}

// Hook Return Types
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  execute: () => Promise<void>;
  refresh: () => void;
}

export interface UseRealtimeDataResult {
  marketData: Record<string, MarketData>;
  smtSignals: SMTSignal[];
  killzoneInfo: KillzoneInfo | null;
  healthStatus: HealthStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}