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

