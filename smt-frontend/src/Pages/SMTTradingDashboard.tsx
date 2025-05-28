import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Dashboard from '../components/Dashboard';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';
import { fetchMarketData, fetchSMTSignals, fetchKillzones, fetchHealth } from '../services/api';

const SMTTradingDashboard: React.FC = () => {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [smtSignals, setSmtSignals] = useState<SMTSignal[]>([]);
  const [killzoneInfo, setKillzoneInfo] = useState<KillzoneInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // WebSocket и fetch эффекты...
  // fetchHealth каждую 30с, killzones каждую минуту, WebSocket market updates

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mdArr, signals] = await Promise.all([
        fetchMarketData('QQQ,SPY'),
        fetchSMTSignals()
      ]);
      setMarketData(Object.fromEntries(mdArr.map(m => [m.symbol, m])));
      setSmtSignals(signals);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header
        isConnected={isConnected}
        error={error}
        isLoading={isLoading}
        lastUpdate={lastUpdate}
        onRefresh={handleRefresh}
      />
      <Dashboard
        marketData={marketData}
        smtSignals={smtSignals}
        killzoneInfo={killzoneInfo}
        healthStatus={healthStatus}
        onRefreshSignals={() => fetchSMTSignals().then(setSmtSignals)}
      />
    </div>
  );
};
  
export default SMTTradingDashboard;
