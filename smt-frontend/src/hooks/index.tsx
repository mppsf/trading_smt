// src/hooks/index.ts
import { useState, useEffect, useCallback, useRef } from 'react';

// useApi Hook - упрощенная версия
export function useApi<T>(fetcher: () => Promise<T>, immediate = true) {
  const [state, setState] = useState({
    data: null as T | null,
    loading: false,
    error: null as string | null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) execute();
  }, [immediate, execute]);

  return { ...state, execute };
}

// useRealtimeData Hook - упрощенная версия
export function useRealtimeData(
  fetcher: () => Promise<any>, 
  interval = 30000
) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateData = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    updateData();
    intervalRef.current = setInterval(updateData, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateData, interval]);

  return { data, loading, error, refresh: updateData };
}

// useWebSocket Hook - упрощенная версия
export function useWebSocket(url: string) {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => setReadyState(WebSocket.OPEN);
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      };
      wsRef.current.onclose = () => setReadyState(WebSocket.CLOSED);
      wsRef.current.onerror = () => setReadyState(WebSocket.CLOSED);
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { readyState, lastMessage, sendMessage };
}

// useLocalStorage Hook - без изменений, но предупреждение
export function useLocalStorage<T>(key: string, defaultValue: T) {
  console.warn('localStorage is not supported in Claude.ai artifacts');
  return [defaultValue, () => {}] as const;
}