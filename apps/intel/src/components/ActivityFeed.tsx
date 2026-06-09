'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { detectDivergence, VALENCE } from '@pulse/shared-types';
import { fetchRecentFeed, type FeedItem } from '@/lib/api';
import { Panel } from './Panel';
import { LiveActivityToastStack, type ActivityToast } from './LiveActivityToast';
import { useRealtime } from './RealtimeProvider';
import { useTaskDetail } from './TaskDetailContext';

function valenceChip(v: number): string {
  if (v >= VALENCE.positive) return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25';
  if (v <= VALENCE.negative) return 'bg-red-500/15 text-red-300 ring-red-500/25';
  return 'bg-slate-500/15 text-slate-300 ring-slate-500/25';
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

const TOAST_TTL_MS = 5000;
const MAX_TOASTS = 3;

const eventLabels: Record<FeedItem['eventType'], string> = {
  created: 'created',
  status_changed: 'moved',
  commented: 'commented',
  reassigned: 'reassigned',
};

const moodColors: Record<FeedItem['mood'], string> = {
  high: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  medium: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  low: 'bg-red-500/15 text-red-300 ring-red-500/25',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
};

const eventIcons: Record<FeedItem['eventType'], ReactNode> = {
  created: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  status_changed: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 21 21 7.5M3 16.5l4.5 4.5" />
    </svg>
  ),
  commented: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  ),
  reassigned: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
};

function formatItem(item: FeedItem): string {
  const who = item.actorName;
  const title = `"${item.taskTitle}"`;
  switch (item.eventType) {
    case 'created':
      return `${who} created ${title}`;
    case 'status_changed':
      return `${who} moved ${title} ${item.oldValue} → ${item.newValue}`;
    case 'commented':
      return `${who} on ${title}: ${item.commentText ?? ''}`;
    case 'reassigned':
      return `${who} reassigned ${title}`;
    default:
      return `${who} updated ${title}`;
  }
}

function FeedIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-white/10">
      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
      </svg>
    </div>
  );
}

export function ActivityFeed() {
  const { openTask } = useTaskDetail();
  const { connected, subscribe } = useRealtime();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ActivityToast[]>([]);
  const seenRef = useRef(new Set<string>());
  const toastTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const hydratedRef = useRef(false);

  const dismissToast = (id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pushToast = (item: FeedItem) => {
    setToasts((prev) => [{ id: item.id, item }, ...prev].slice(0, MAX_TOASTS));
    const timer = setTimeout(() => dismissToast(item.id), TOAST_TTL_MS);
    toastTimersRef.current.set(item.id, timer);
  };

  // Hydrate recent history once (SSE only carries events after connect).
  useEffect(() => {
    let cancelled = false;
    fetchRecentFeed()
      .then((recent) => {
        if (cancelled) return;
        setItems(recent);
        recent.forEach((item) => seenRef.current.add(item.id));
      })
      .catch(() => {
        /* history optional — live events still arrive */
      })
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live events from the shared SSE connection.
  useEffect(() => {
    const unsubscribe = subscribe((item) => {
      if (!seenRef.current.has(item.id)) {
        seenRef.current.add(item.id);
        setFlashId(item.id);
        setTimeout(() => setFlashId(null), 1200);
        if (hydratedRef.current) pushToast(item);
      }
      setItems((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev;
        return [item, ...prev].slice(0, 50);
      });
    });
    const timers = toastTimersRef.current;
    return () => {
      unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, [subscribe]);

  const emptyMessage = loading
    ? 'Loading recent activity…'
    : 'No activity yet — create or update tasks on the Board.';

  return (
    <>
    <LiveActivityToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      onOpen={(taskId) => openTask(taskId)}
    />
    <Panel
      title="Live activity"
      subtitle="Recent history + real-time events via SSE"
      icon={<FeedIcon />}
      trailing={
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset transition-colors duration-300 ${
            connected
              ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
              : 'bg-red-500/15 text-red-300 ring-red-500/25'
          }`}
          title={connected ? 'Connected' : 'Disconnected'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`}
          />
          {connected ? 'Live' : 'Offline'}
        </span>
      }
    >
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {items.map((item) => {
          const divergence =
            item.sentiment != null
              ? detectDivergence({
                  valence: item.sentiment,
                  mood: item.mood,
                  healthScore: item.healthScore,
                })
              : null;
          return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openTask(item.taskId)}
              className={`pulse-card-expandable group w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-300 ${
                flashId === item.id
                  ? 'border-pulse-accent/40 bg-pulse-accent/10 shadow-lg shadow-pulse-accent/10'
                  : 'border-white/5 bg-pulse-bg/50 hover:border-pulse-accent/25 hover:bg-pulse-bg/70'
              }`}
              aria-label={`View task details for ${item.taskTitle}`}
            >
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/6 text-pulse-muted">
                  {eventIcons[item.eventType]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug text-slate-200">{formatItem(item)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-pulse-muted">
                    <span className="capitalize">{eventLabels[item.eventType]}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium capitalize ring-1 ring-inset ${moodColors[item.mood]}`}
                      title="Energy"
                    >
                      {item.mood}
                    </span>
                    {item.sentiment != null && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-medium tabular-nums ring-1 ring-inset ${valenceChip(item.sentiment)}`}
                        title="Sentiment valence (−1..1)"
                      >
                        {signed(item.sentiment)}
                      </span>
                    )}
                    <time dateTime={item.occurredAt}>
                      {new Date(item.occurredAt).toLocaleTimeString()}
                    </time>
                    <span className="ml-auto flex items-center gap-0.5 font-medium text-pulse-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      Task
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </span>
                  </div>
                  {divergence && (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20">
                      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      {divergence}
                    </p>
                  )}
                </div>
              </div>
            </button>
          </li>
          );
        })}
        {items.length === 0 && (
          <li className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center">
            <div className="h-8 w-8 animate-pulse rounded-full border-2 border-white/10 border-t-pulse-accent" />
            <p className="text-xs text-slate-600">{emptyMessage}</p>
          </li>
        )}
      </ul>
    </Panel>
    </>
  );
}
