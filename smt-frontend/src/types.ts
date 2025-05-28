// src/types.ts
export interface MarketData {
  symbol: string;
  current_price: number;
  change_percent: number;
  volume?: number;
  timestamp: string;
  market_state?: string;
}

export interface SMTSignal {
  id: string;
  timestamp: string;
  signal_type: 'bullish_divergence' | 'bearish_divergence' | 'neutral';
  strength: number;
  divergence_percentage: number;
  nasdaq_price: number;
  sp500_price: number;
  confirmation_status: boolean;
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
  redis: 'healthy' | 'offline' | 'error';
  timestamp: string;
}

export interface Settings {
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  [key: string]: number | number[];
}