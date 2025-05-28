// src/services/api.ts
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus, Settings } from '../types';

const BASE = 'http://localhost:8000';

export async function fetchMarketData(symbols: string, timeframe = '5m', limit = 100): Promise<MarketData[]> {
  const res = await fetch(`${BASE}/api/v1/market-data?symbols=${symbols}&timeframe=${timeframe}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch market data');
  return res.json();
}

export async function fetchSMTSignals(limit = 50): Promise<SMTSignal[]> {
  const res = await fetch(`${BASE}/api/v1/smt-signals?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch SMT signals');
  return res.json();
}

export async function fetchKillzones(): Promise<KillzoneInfo> {
  const res = await fetch(`${BASE}/api/v1/killzones`);
  if (!res.ok) throw new Error('Failed to fetch killzones');
  return res.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health status');
  return res.json();
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${BASE}/api/v1/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(payload: Partial<Settings>): Promise<Settings> {
  const res = await fetch(`${BASE}/api/v1/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}