'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ActivityFeedItem } from '@pulse/shared-types';
import { getToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';

type Handler = (item: ActivityFeedItem) => void;

interface RealtimeContextValue {
  connected: boolean;
  /** Subscribe to live feed events. Returns an unsubscribe fn. */
  subscribe: (handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Owns the single Intel SSE connection and fans events out to subscribers
 * (the feed, the mood map). One stream, many consumers — no duplicate
 * EventSource per component.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef(new Set<Handler>());

  useEffect(() => {
    const token = getToken();
    const url = token
      ? `${API_URL}/intel/feed?token=${encodeURIComponent(token)}`
      : `${API_URL}/intel/feed`;

    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const item = JSON.parse(ev.data) as ActivityFeedItem;
        handlers.current.forEach((h) => h(item));
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => es.close();
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}
