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
  change_percent?: number;
  volume?: number;
  timestamp: string;
  ohlcv: OHLCVData[];
  market_state?: 'open' | 'closed' | 'pre_market' | 'after_hours' | 'unknown';
}

// Обновленный enum согласно схеме API
export enum SMTSignalType {
  SMT_BULLISH_DIVERGENCE = "smt_bullish_divergence",
  SMT_BEARISH_DIVERGENCE = "smt_bearish_divergence", 
  FALSE_BREAK_UP = "false_break_up",
  FALSE_BREAK_DOWN = "false_break_down",
  VOLUME_SPIKE = "volume_spike",
  VOLUME_DIVERGENCE_BULLISH = "volume_divergence_bullish",
  VOLUME_DIVERGENCE_BEARISH = "volume_divergence_bearish",
  JUDAS_SWING_BULLISH = "judas_swing_bullish",
  JUDAS_SWING_BEARISH = "judas_swing_bearish"
}

export interface SMTSignal {
  timestamp: string;
  signal_type: SMTSignalType;
  strength: number; // 0.0 - 1.0
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
  market_phase?: 'trending' | 'consolidation' | 'reversal' | 'breakout' | 'unknown';
}

export interface AnalysisStats {
  total_signals: number;
  confirmed_signals: number;
  signal_distribution: Record<string, number>;
  avg_strength: number;
  last_analysis: string;
}

export interface TrueOpensResponse {
  es_opens: TrueOpenData;
  nq_opens: TrueOpenData;
}

export interface TrueOpenData {
  daily?: number | null;
  weekly?: number | null;
  quarterly?: number | null;
  timestamp: string;
}

export interface FractalPoint {
  timestamp: string;
  price: number;
  type: 'high' | 'low';
  index: number;
}

export interface FractalsResponse {
  symbol: string;
  high_fractals: FractalPoint[];
  low_fractals: FractalPoint[];
  timestamp: string;
}

export interface VolumeAnomaly {
  timestamp: string;
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  anomaly_type: string;
  significance: number;
}

export interface Killzone {
  name: string;
  start_time: string;
  end_time: string;
  description?: string;
  is_active: boolean;
  timezone?: string;
}

export interface KillzonesResponse {
  killzones: Killzone[];
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  redis: 'connected' | 'disconnected' | 'unknown';
  timestamp: string;
}

export interface Settings {
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  divergence_threshold?: number;
  confirmation_candles?: number;
  volume_multiplier?: number;
  london_open?: string;
  ny_open?: string;
  asia_open?: string;
}

export interface SettingsUpdateRequest extends Partial<Settings> {}

export interface ErrorResponse {
  detail: string;
}

export interface ValidationErrorResponse {
  detail: string;
}

// Параметры для получения сигналов
export interface SMTSignalsParams {
  limit?: number;
  signal_type?: string;
  min_strength?: number;
  confirmed_only?: boolean;
  smt_strength_threshold?: number;
  divergence_threshold?: number;
  confirmation_candles?: number;
  volume_multiplier?: number;
  max_signals_display?: number;
  refresh_interval?: number;
  london_open?: string;
  ny_open?: string;
  asia_open?: string;
  killzone_priorities?: string;
}

// Параметры для рыночных данных
export interface MarketDataParams {
  symbols?: string;
  timeframe?: '5m' | '15m' | '1h' | '1d';
  limit?: number;
}

// Параметры для фракталов
export interface FractalsParams {
  symbol?: string;
  limit?: number;
}

// Параметры для аномалий объема
export interface VolumeAnomaliesParams {
  symbol?: string;
  threshold?: number;
  limit?: number;
}

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