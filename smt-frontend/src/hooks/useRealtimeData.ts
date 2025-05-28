import { useEffect, useRef, useState } from 'react';
import { fetchAllData } from '../services/api';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus, Settings } from '../types';

interface RealtimeData {
  marketData: Record<string, MarketData>;
  smtSignals: SMTSignal[];
  killzoneInfo: KillzoneInfo | null;
  healthStatus: HealthStatus | null;
  settings: Settings | null;
}

export function useRealtimeData(updateInterval = 5000) {
  const [data, setData] = useState<RealtimeData>({
    marketData: {},
    smtSignals: [],
    killzoneInfo: null,
    healthStatus: null,
    settings: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateData = async () => {
    try {
      const result = await fetchAllData();
      
      // Преобразуем массив marketData в объект по символам
      const marketDataObj = result.marketData.reduce((acc, item) => {
        acc[item.symbol] = item;
        return acc;
      }, {} as Record<string, MarketData>);

      setData({
        marketData: marketDataObj,
        smtSignals: result.smtSignals,
        killzoneInfo: result.killzones,
        healthStatus: result.health,
        settings: result.settings
      });
      
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    intervalRef.current = setInterval(updateData, updateInterval);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  };

  useEffect(() => {
    updateData(); // Initial load
    startPolling();
    return stopPolling;
  }, [updateInterval]);

  return {
    ...data,
    loading,
    error,
    lastUpdate,
    refresh: updateData,
    startPolling,
    stopPolling
  };
}

// src/hooks/useLocalStorage.ts
