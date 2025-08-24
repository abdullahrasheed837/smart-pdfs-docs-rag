// frontend/src/lib/sse.ts
import { useState, useCallback } from 'react';

interface UseSSEOptions {
  onMessage?: (data: string) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    try {
      const eventSource = new EventSource(url);
      
      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        options.onOpen?.();
      };

      eventSource.onmessage = (event) => {
        options.onMessage?.(event.data);
      };

      eventSource.onerror = (event) => {
        setIsConnected(false);
        setError('SSE connection error');
        options.onError?.(event);
      };

      return () => {
        eventSource.close();
        setIsConnected(false);
        options.onClose?.();
      };
    } catch (err) {
      setError('Failed to create SSE connection');
      return () => {};
    }
  }, [url, options]);

  return {
    connect,
    isConnected,
    error,
  };
}

// Helper function to create streaming query URL
export function createStreamingQueryURL(baseURL: string, query: string, dataset: string) {
  const params = new URLSearchParams({
    query,
    dataset,
    stream: 'true',
  });
  return `${baseURL}/query/stream?${params.toString()}`;
} 