// src/components/SMTTradingDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from '../components/Dashboard';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';
import { fetchMarketData, fetchSMTSignals, fetchKillzones, fetchHealth } from '../services/api';

const SMTTradingDashboard: React.FC = () => {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [smtSignals, setSMTSignals] = useState<SMTSignal[]>([]);
  const [killzoneInfo, setKillzoneInfo] = useState<KillzoneInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [market, signals, killzone, health] = await Promise.allSettled([
        fetchMarketData('QQQ,SPY'),
        fetchSMTSignals(),
        fetchKillzones(),
        fetchHealth()
      ]);

      if (market.status === 'fulfilled') {
        // Адаптируем массив в объект с ключами по символам
        const marketObj: Record<string, MarketData> = {};
        market.value.forEach(item => {
          marketObj[item.symbol] = item;
        });
        setMarketData(marketObj);
      }
      if (signals.status === 'fulfilled') setSMTSignals(signals.value);
      if (killzone.status === 'fulfilled') setKillzoneInfo(killzone.value);
      if (health.status === 'fulfilled') setHealthStatus(health.value);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSignals = useCallback(async () => {
    try {
      const signals = await fetchSMTSignals();
      setSMTSignals(signals);
    } catch (err) {
      console.error('Failed to refresh signals:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && Object.keys(marketData).length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading SMT Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Error Loading Dashboard</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">SMT Trading Dashboard</h1>
          <div className="text-gray-400 text-sm">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </header>
      
      <Dashboard
        marketData={marketData}
        smtSignals={smtSignals}
        killzoneInfo={killzoneInfo}
        healthStatus={healthStatus}
        onRefreshSignals={refreshSignals}
      />
    </div>
  );
};

export default SMTTradingDashboard;