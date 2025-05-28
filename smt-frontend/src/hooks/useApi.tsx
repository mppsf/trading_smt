// src/hooks/useApi.ts
import { useState, useEffect, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

interface UseApiOptions {
  immediate?: boolean;
  refreshInterval?: number;
  retryCount?: number;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
) {
  const { immediate = true, refreshInterval, retryCount = 0 } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null
  });

  const [retries, setRetries] = useState(0);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fetcher();
      setState({
        data,
        loading: false,
        error: null,
        lastFetch: new Date()
      });
      setRetries(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (retries < retryCount) {
        setRetries(prev => prev + 1);
        setTimeout(execute, 1000 * Math.pow(2, retries)); // Exponential backoff
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
      }
    }
  }, [fetcher, retries, retryCount]);

  const refresh = useCallback(() => {
    setRetries(0);
    execute();
  }, [execute]);

  useEffect(() => {
    if (immediate) execute();
  }, [immediate, execute]);

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return {
    ...state,
    execute,
    refresh
  };
}

// src/hooks/useRealtimeData.ts
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
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = (newValue: T | ((val: T) => T)) => {
    try {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
      setValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  };

  return [value, setStoredValue] as const;
}

// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';

interface UseWebSocketOptions {
  onOpen?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const {
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const connect = () => {
    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        setReadyState(WebSocket.OPEN);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        onMessage?.(data);
      };

      wsRef.current.onerror = (error) => {
        setReadyState(WebSocket.CLOSED);
        onError?.(error);
      };

      wsRef.current.onclose = () => {
        setReadyState(WebSocket.CLOSED);
        onClose?.();
        
        // Auto-reconnect logic
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    connect();
    return disconnect;
  }, [url]);

  return {
    readyState,
    lastMessage,
    sendMessage,
    disconnect,
    reconnect: connect
  };
}