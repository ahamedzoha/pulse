'use client';

import type { FeedItem } from '@/lib/api';

const eventAccent: Record<FeedItem['eventType'], string> = {
  created: 'from-emerald-500/80 to-teal-400/60',
  status_changed: 'from-sky-500/80 to-cyan-400/60',
  commented: 'from-violet-500/80 to-purple-400/60',
  reassigned: 'from-amber-500/80 to-orange-400/60',
};

const eventLabels: Record<FeedItem['eventType'], string> = {
  created: 'New task',
  status_changed: 'Status change',
  commented: 'Comment',
  reassigned: 'Reassigned',
};

const moodColors: Record<FeedItem['mood'], string> = {
  high: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  medium: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  low: 'bg-red-500/15 text-red-300 ring-red-500/25',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
};

function toastSummary(item: FeedItem): string {
  switch (item.eventType) {
    case 'created':
      return `${item.actorName} created a task`;
    case 'status_changed':
      return `${item.actorName} moved · ${item.oldValue} → ${item.newValue}`;
    case 'commented':
      return `${item.actorName} commented`;
    case 'reassigned':
      return `${item.actorName} reassigned`;
    default:
      return `${item.actorName} updated`;
  }
}

export interface ActivityToast {
  id: string;
  item: FeedItem;
}

interface Props {
  toasts: ActivityToast[];
  onDismiss: (id: string) => void;
  onOpen: (taskId: string) => void;
}

export function LiveActivityToastStack({ toasts, onDismiss, onOpen }: Props) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2.5 sm:bottom-6 sm:right-6"
      aria-live="polite"
      aria-label="Live activity notifications"
    >
      {toasts.map((toast) => {
        const { item } = toast;
        const accent = eventAccent[item.eventType];

        return (
          <div
            key={toast.id}
            className="pulse-activity-toast pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-pulse-panel/95 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(139,92,246,0.25)] backdrop-blur-xl"
            role="status"
          >
            <div className={`h-0.5 w-full bg-gradient-to-r ${accent}`} />

            <div className="relative px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors duration-200 hover:bg-white/8 hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
                  aria-label="Dismiss notification"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpen(item.taskId)}
                className="group/toast w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
              >
                <p className="text-[11px] font-medium text-pulse-muted">
                  {eventLabels[item.eventType]}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-slate-200">
                  {toastSummary(item)}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-violet-200 transition-colors duration-200 group-hover/toast:text-white">
                  {item.taskTitle}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${moodColors[item.mood]}`}
                  >
                    {item.mood}
                  </span>
                  <time
                    className="text-[10px] tabular-nums text-slate-500"
                    dateTime={item.occurredAt}
                  >
                    {new Date(item.occurredAt).toLocaleTimeString()}
                  </time>
                  <span className="ml-auto text-[10px] font-medium text-pulse-accent opacity-0 transition-opacity duration-200 group-hover/toast:opacity-100">
                    View task →
                  </span>
                </div>
              </button>

              <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/5">
                <div className="pulse-activity-toast-progress h-full bg-gradient-to-r from-pulse-accent/70 to-violet-400/50" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
