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
  }
  
  export type SignalType = 'bullish_divergence' | 'bearish_divergence' | 'neutral';
  
  export interface SMTSignal {
    timestamp: string;
    signal_type: SignalType;
    strength: number;
    nasdaq_price: number;
    sp500_price: number;
    divergence_percentage: number;
    confirmation_status: boolean;
  }
  
  export type Priority = 'high' | 'medium' | 'low';
  
  export interface KillzoneInfo {
    current: string | null;
    time_remaining: string;
    next_session: string;
    priority: Priority;
  }
  
  export interface HealthStatus {
    status: string;
    redis_status: string;
    timestamp: string;
  }
  
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
