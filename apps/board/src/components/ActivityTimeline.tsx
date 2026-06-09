'use client';

import { VALENCE, type EventType, type Mood } from '@pulse/shared-types';
import type { TaskEventItem } from '@/lib/api';
import { formatRelativeTime } from '@/lib/time';
import { UserAvatar } from './UserAvatar';

function valenceMeta(v: number): { label: string; cls: string } {
  if (v >= VALENCE.positive) {
    return { label: 'positive', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25' };
  }
  if (v <= VALENCE.negative) {
    return { label: 'negative', cls: 'bg-red-500/15 text-red-300 ring-red-500/25' };
  }
  return { label: 'neutral', cls: 'bg-slate-500/15 text-slate-300 ring-slate-500/25' };
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

const MOOD_STYLES: Record<Mood, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  medium: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  low: 'bg-red-500/15 text-red-300 ring-red-500/25',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
};

const EVENT_LABELS: Record<EventType, string> = {
  created: 'Created',
  status_changed: 'Moved',
  commented: 'Comment',
  reassigned: 'Reassigned',
};

const STATUS_TEXT: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const prettyStatus = (v?: string) => (v ? (STATUS_TEXT[v] ?? v) : '?');

function summary(event: TaskEventItem): string {
  switch (event.eventType) {
    case 'created':
      return `${event.actorName} created this task`;
    case 'status_changed':
      return `${event.actorName} moved ${prettyStatus(event.oldValue)} → ${prettyStatus(event.newValue)}`;
    case 'commented':
      return event.commentText ?? `${event.actorName} commented`;
    case 'reassigned':
      return `${event.actorName} reassigned the task`;
    default:
      return `${event.actorName} updated the task`;
  }
}

export function ActivityTimeline({ events }: { events: TaskEventItem[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-600">
        No activity yet — post a comment or move this task to start its story.
      </p>
    );
  }

  return (
    <ul className="relative space-y-0">
      <span
        className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-pulse-accent/40 via-white/10 to-transparent"
        aria-hidden
      />
      {events.map((event, i) => {
        const isComment = event.eventType === 'commented';
        return (
          <li
            key={event.id}
            className="pulse-fade-in relative pb-4 pl-8 last:pb-0"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <span
              className="absolute left-0 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/10 bg-pulse-elevated text-[9px] font-bold text-pulse-muted"
              aria-hidden
            >
              {EVENT_LABELS[event.eventType].slice(0, 1)}
            </span>
            <div
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                isComment
                  ? 'border-white/10 bg-pulse-elevated/60 hover:border-white/15'
                  : 'border-white/6 bg-pulse-bg/40 hover:border-white/12 hover:bg-pulse-bg/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-muted">
                  {EVENT_LABELS[event.eventType]}
                </p>
                <time
                  className="shrink-0 text-[10px] tabular-nums text-pulse-muted"
                  dateTime={event.occurredAt}
                >
                  {formatRelativeTime(event.occurredAt)}
                </time>
              </div>
              <p
                className={`mt-1 leading-snug text-slate-200 ${
                  isComment ? 'text-sm' : 'text-[13px]'
                }`}
              >
                {summary(event)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <UserAvatar name={event.actorName} />
                <span className="text-[11px] text-pulse-muted">
                  {event.actorName}
                </span>
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${MOOD_STYLES[event.mood]}`}
                  title="Energy"
                >
                  {event.mood}
                </span>
              </div>

              {(event.sentiment != null || event.emotions?.length) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/6 pt-2">
                  {event.sentiment != null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ring-1 ring-inset ${valenceMeta(event.sentiment).cls}`}
                      title="Sentiment valence (−1..1)"
                    >
                      {valenceMeta(event.sentiment).label} {signed(event.sentiment)}
                    </span>
                  )}
                  {event.emotions?.map((e) => (
                    <span
                      key={e}
                      className="rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] text-slate-300"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
