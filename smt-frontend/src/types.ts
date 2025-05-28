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

  export type SMTSignalType = 
    | "smt_bullish_divergence"
    | "smt_bearish_divergence" 
    | "false_break_up"
    | "false_break_down"
    | "volume_spike"
    | "volume_divergence_bullish"
    | "volume_divergence_bearish"
    | "judas_swing_bullish"
    | "judas_swing_bearish";

  export interface SMTSignal {
    id: string;
    timestamp: string;
    signal_type: SMTSignalType;
    strength: number;
    nasdaq_price: number;
    sp500_price: number;
    divergence_percentage: number;
    confirmation_status: boolean;
    market_phase?: 'trending' | 'consolidation' | 'reversal' | 'breakout' | 'unknown';
    details?: Record<string, any>;
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

  export interface KillzoneInfo {
    current: string | null;
    priority: 'high' | 'medium' | 'low';
    time_remaining: string;
    next_session: string;
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

  export interface MarketDataParams {
    symbols?: string;
    timeframe?: '5m' | '15m' | '1h' | '1d';
    limit?: number;
  }

  export interface FractalsParams {
    symbol?: string;
    limit?: number;
  }

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

  //todo объединить с выводом: 
  // src/types/index.ts - Оптимизированные типы
export type SMTSignalType = 
| 'smt_bullish_divergence' 
| 'smt_bearish_divergence'
| 'false_break_up' 
| 'false_break_down'
| 'volume_spike'
| 'volume_divergence_bullish'
| 'volume_divergence_bearish'
| 'judas_swing_bullish'
| 'judas_swing_bearish';

export type MarketState = 'open' | 'closed' | 'pre_market' | 'after_hours';

// Основные интерфейсы данных
export interface MarketData {
symbol: string;
current_price: number;
change_percent: number;
volume?: number;
market_state?: MarketState;
timestamp: string;
}

export interface SMTSignal {
id?: string;
signal_type: SMTSignalType;
strength: number;
divergence_percentage: number;
nasdaq_price: number;
sp500_price: number;
timestamp: string;
confirmation_status?: boolean;
market_phase?: string;
}

export interface KillzoneInfo {
current: string | null;
priority: 'high' | 'medium' | 'low';
time_remaining: string;
next_session: string;
}

export interface HealthStatus {
status: string;
redis: string;
timestamp: string;
}

export interface Settings {
// Активные параметры (используются в API)
smt_strength_threshold: number;
max_signals_display: number;
divergence_threshold: number;
confirmation_candles: number;
volume_multiplier: number;

// Системные параметры
killzone_priorities: number[];
refresh_interval: number;

// Опциональные параметры времени сессий (не используются в API)
london_open?: string;
ny_open?: string;
asia_open?: string;
}

// API ответы (минимизированы)
export interface SMTAnalysisResponse {
signals: SMTSignal[];
total_count?: number;
filtered_count?: number;
}

export interface ErrorResponse {
detail: string;
status_code?: number;
}

// Удаляем избыточные интерфейсы параметров
// Теперь используем Record<string, any> для гибкости
  