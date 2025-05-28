import { MarketData, SMTSignal, KillzoneInfo, HealthStatus, Settings } from '../types';

const BASE = 'http://localhost:8000';

// Existing functions
export async function fetchMarketData(symbols: string, timeframe = '5m', limit = 100): Promise<MarketData[]> {
  const res = await fetch(`${BASE}/api/v1/market-data?symbols=${symbols}&timeframe=${timeframe}&limit=${limit}`);
  return res.json();
}

export async function fetchSMTSignals(limit = 50): Promise<SMTSignal[]> {
  const res = await fetch(`${BASE}/api/v1/smt-signals?limit=${limit}`);
  return res.json();
}

export async function fetchKillzones(): Promise<KillzoneInfo> {
  const res = await fetch(`${BASE}/api/v1/killzones`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

// New functions for dynamic settings
export interface SettingsPayload {
  min_divergence_threshold?: number;
  lookback_period?: number;
  swing_threshold?: number;
  lookback_swings?: number;
  min_block_size?: number;
  volume_threshold?: number;
  min_fvg_gap_size?: number;
  quarterly_months?: number[];
  monthly_bias_days?: number[];
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${BASE}/api/v1/settings`);
  return res.json();
}

export async function updateSettings(payload: SettingsPayload): Promise<Settings> {
  const res = await fetch(`${BASE}/api/v1/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

