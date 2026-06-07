'use client';

import { useEffect, useRef, useState } from 'react';
import type { IntelChatTurn } from '@pulse/shared-types';
import {
  clearChatHistory,
  fetchChatHistory,
  streamQuery,
  type RagSource,
} from '@/lib/api';
import { FormattedAnswer } from '@/lib/format-answer';
import { Spinner } from './Spinner';

const SUGGESTIONS = [
  "What's the current status of the project?",
  'Which tasks are at risk or have low health?',
  'What caused the Entra login redirect issue?',
  'Summarize recent team activity',
];

const STATUS_STYLES: Record<string, string> = {
  done: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  in_progress: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  review: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  todo: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
};

type TurnStatus = 'streaming' | 'done' | 'error';

interface ChatTurn {
  id: string;
  question: string;
  answer: string;
  sources: RagSource[];
  error: string;
  status: TurnStatus;
}

function toChatTurn(row: IntelChatTurn): ChatTurn {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sources: row.sources,
    error: row.error ?? '',
    status: row.error ? 'error' : 'done',
  };
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function SourceCard({ source, index }: { source: RagSource; index: number }) {
  const pct = Math.round(source.score * 100);
  const style = STATUS_STYLES[source.status] ?? STATUS_STYLES.todo;

  return (
    <li className="group rounded-lg border border-white/5 bg-pulse-bg/70 p-3 transition hover:border-pulse-accent/30 hover:bg-pulse-bg">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="mr-2 text-[10px] font-medium tabular-nums text-pulse-muted">
            #{index + 1}
          </span>
          <span className="text-xs font-medium text-slate-200">{source.title}</span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${style}`}
        >
          {statusLabel(source.status)}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-pulse-muted">
        {source.contentText}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pulse-accent/60 to-violet-400/80"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-pulse-muted">{pct}% match</span>
      </div>
    </li>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] rounded-2xl rounded-br-md border border-pulse-accent/25 bg-gradient-to-br from-pulse-accent/20 to-violet-600/15 px-4 py-2.5 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-100">{text}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ turn, isLatest }: { turn: ChatTurn; isLatest: boolean }) {
  const [sourcesOpen, setSourcesOpen] = useState(isLatest);

  useEffect(() => {
    if (isLatest && turn.sources.length > 0) setSourcesOpen(true);
  }, [isLatest, turn.sources.length]);

  const thinking = turn.status === 'streaming' && !turn.answer && !turn.error;

  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pulse-accent/30 to-violet-600/20 ring-1 ring-white/10">
        <svg className="h-3.5 w-3.5 text-pulse-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/6 bg-pulse-bg/60 px-4 py-3">
        {turn.error ? (
          <p className="text-sm text-red-300">{turn.error}</p>
        ) : thinking ? (
          <div className="flex items-center gap-2 text-sm text-pulse-muted">
            <span className="flex gap-1" aria-label="Thinking">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse-accent [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse-accent [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse-accent [animation-delay:300ms]" />
            </span>
            Synthesizing from activity…
          </div>
        ) : (
          <>
            {turn.answer ? <FormattedAnswer text={turn.answer} /> : null}
            {turn.status === 'streaming' && turn.answer && (
              <span className="mt-1 inline-block h-4 w-0.5 animate-pulse bg-pulse-accent" />
            )}
          </>
        )}

        {turn.sources.length > 0 && (
          <div className="mt-3 border-t border-white/6 pt-3">
            <button
              type="button"
              onClick={() => setSourcesOpen((o) => !o)}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-pulse-muted transition-colors duration-200 hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
            >
              <span>
                Sources
                <span className="ml-2 rounded-full bg-white/8 px-1.5 py-0.5 tabular-nums text-slate-400">
                  {turn.sources.length}
                </span>
              </span>
              <svg
                className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${sourcesOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {sourcesOpen && (
              <ul className="mt-2 space-y-2">
                {turn.sources.slice(0, 6).map((s, i) => (
                  <SourceCard key={`${s.taskId}-${i}`} source={s} index={i} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AiPanel() {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTurnRef = useRef<string | null>(null);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  };

  useEffect(() => {
    fetchChatHistory()
      .then((rows) => setTurns(rows.map(toChatTurn)))
      .catch(() => {
        /* show empty state if history unavailable */
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (!loadingHistory) scrollToBottom(turns.length > 0);
  }, [turns, loadingHistory]);

  const patchTurn = (id: string, patch: Partial<ChatTurn>) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const runQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || busy) return;

    setDraft('');
    setBusy(true);

    const optimisticId = crypto.randomUUID();
    activeTurnRef.current = optimisticId;
    setTurns((prev) => [
      ...prev,
      {
        id: optimisticId,
        question: trimmed,
        answer: '',
        sources: [],
        error: '',
        status: 'streaming',
      },
    ]);

    let turnId = optimisticId;

    try {
      for await (const chunk of streamQuery(trimmed)) {
        if (chunk.type === 'turn') {
          turnId = chunk.id;
          activeTurnRef.current = turnId;
          setTurns((prev) =>
            prev.map((t) =>
              t.id === optimisticId ? { ...t, id: chunk.id } : t,
            ),
          );
        } else if (chunk.type === 'sources') {
          patchTurn(turnId, { sources: chunk.sources });
        } else if (chunk.type === 'token') {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId ? { ...t, answer: t.answer + chunk.value } : t,
            ),
          );
        } else if (chunk.type === 'error') {
          patchTurn(turnId, { error: chunk.message, status: 'error' });
        } else if (chunk.type === 'done') {
          patchTurn(turnId, { status: 'done' });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      patchTurn(turnId, { error: message, status: 'error' });
    } finally {
      activeTurnRef.current = null;
      setBusy(false);
    }
  };

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    void runQuery(draft);
  };

  const clearChat = async () => {
    if (busy) return;
    try {
      await clearChatHistory();
      setTurns([]);
      setDraft('');
    } catch {
      /* keep UI if delete fails */
    }
  };

  return (
    <section className="pulse-glass flex h-full min-h-0 flex-col overflow-hidden transition-shadow duration-300 hover:shadow-[0_12px_40px_-10px_rgba(139,92,246,0.15)]">
      <header className="relative shrink-0 border-b border-white/6 px-5 py-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pulse-accent/10 via-transparent to-transparent" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pulse-accent to-violet-600 shadow-lg shadow-pulse-accent/20">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Pulse Intel AI
              </h2>
              <p className="text-[11px] text-pulse-muted">
                RAG over team activity · pgvector + Qwen
              </p>
            </div>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => void clearChat()}
              disabled={busy}
              className="pulse-btn-ghost shrink-0 text-[10px] uppercase tracking-wider disabled:opacity-40"
            >
              Clear chat
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
          aria-label="Chat history"
        >
          {loadingHistory && (
            <div className="flex h-full min-h-[180px] items-center justify-center">
              <Spinner label="Loading chat history…" size="sm" />
            </div>
          )}

          {!loadingHistory && turns.length === 0 && !busy && (
            <div className="flex h-full min-h-[180px] flex-col justify-center">
              <p className="mb-4 text-center text-sm text-pulse-muted">
                Ask anything about tasks, blockers, or team momentum.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void runQuery(s)}
                    className="cursor-pointer rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] text-slate-300 transition-colors duration-200 hover:border-pulse-accent/40 hover:bg-pulse-accent/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingHistory && turns.length > 0 && (
            <div className="space-y-5">
              {turns.map((turn, i) => (
                <div key={turn.id} className="space-y-3">
                  <UserBubble text={turn.question} />
                  <AssistantBubble
                    turn={turn}
                    isLatest={i === turns.length - 1}
                  />
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>

        <form
          onSubmit={ask}
          className="shrink-0 border-t border-white/6 bg-pulse-bg/40 p-4"
        >
          <div className="flex gap-2 rounded-xl border border-white/8 bg-pulse-bg/80 p-1.5 shadow-inner focus-within:border-pulse-accent/50 focus-within:ring-1 focus-within:ring-pulse-accent/20">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Ask about team activity…"
              disabled={busy}
              className="min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:outline-none disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void runQuery(draft);
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center self-end rounded-lg bg-gradient-to-br from-pulse-accent to-violet-600 text-white shadow-md shadow-pulse-accent/25 transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={busy ? 'Thinking' : 'Send question'}
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">
            Enter to send · Shift+Enter for new line
            {turns.length > 0 ? ` · ${turns.length} message${turns.length === 1 ? '' : 's'}` : ''}
          </p>
        </form>
      </div>
    </section>
  );
}
