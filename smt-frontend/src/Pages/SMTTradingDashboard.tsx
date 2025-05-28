// src/Pages/SMTTradingDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from '../components/Dashboard';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';
import { fetchMarketData, fetchSMTSignals, fetchKillzones, fetchHealth } from '../services/api';

const SMTTradingDashboard: React.FC = () => {
  const [state, setState] = useState({
    marketData: {} as Record<string, MarketData>,
    smtSignals: [] as SMTSignal[],
    killzoneInfo: null as KillzoneInfo | null,
    healthStatus: null as HealthStatus | null,
    loading: true,
    error: null as string | null,
  });

  const loadData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const [market, signals, killzone, health] = await Promise.allSettled([
        fetchMarketData('QQQ,SPY'),
        fetchSMTSignals(),
        fetchKillzones(),
        fetchHealth()
      ]);

      const marketObj: Record<string, MarketData> = {};
      if (market.status === 'fulfilled' && Array.isArray(market.value)) {
        market.value.forEach(item => {
          marketObj[item.symbol] = item;
        });
      }

      // Ensure signals is always an array
      let signalsArray: SMTSignal[] = [];
      if (signals.status === 'fulfilled' && Array.isArray(signals.value)) {
        signalsArray = signals.value;
      } else if (signals.status === 'rejected') {
        console.error('Failed to fetch SMT signals:', signals.reason);
      }

      setState(prev => ({
        ...prev,
        marketData: marketObj,
        smtSignals: signalsArray,
        killzoneInfo: killzone.status === 'fulfilled' ? killzone.value : prev.killzoneInfo,
        healthStatus: health.status === 'fulfilled' ? health.value : prev.healthStatus,
        loading: false,
      }));
    } catch (err) {
      console.error('Error in loadData:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load data',
        loading: false,
        // Ensure we maintain empty array for signals even on error
        smtSignals: Array.isArray(prev.smtSignals) ? prev.smtSignals : [],
      }));
    }
  }, []);

  const refreshSignals = useCallback(async () => {
    try {
      const signals = await fetchSMTSignals();
      // Ensure the fetched signals is an array
      const signalsArray = Array.isArray(signals) ? signals : [];
      setState(prev => ({ ...prev, smtSignals: signalsArray }));
    } catch (err) {
      console.error('Failed to refresh signals:', err);
      // Don't reset signals on refresh error, just log it
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (state.loading && Object.keys(state.marketData).length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading SMT Dashboard...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Error Loading Dashboard</div>
          <div className="text-gray-400 mb-4">{state.error}</div>
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
        marketData={state.marketData}
        smtSignals={state.smtSignals}
        killzoneInfo={state.killzoneInfo}
        healthStatus={state.healthStatus}
        onRefreshSignals={refreshSignals}
      />
    </div>
  );
};

export default SMTTradingDashboard;