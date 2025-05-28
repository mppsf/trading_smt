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