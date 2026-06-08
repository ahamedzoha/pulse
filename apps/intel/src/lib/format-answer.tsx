'use client';

import type { ReactNode } from 'react';
import type { LeaderboardEntry, RagSource } from '@/lib/api';
import { useTaskDetail } from '@/components/TaskDetailContext';
import { UserAvatar } from '@/components/UserAvatar';
import { healthBarClasses, healthChipClasses, healthColor } from '@/lib/health';
import type { HealthColor } from '@/lib/health';

export type LinkableTask = {
  taskId: string;
  title: string;
  status?: string;
  healthScore?: number;
  assigneeName?: string | null;
  contentText?: string;
  score?: number;
};

type ParsedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'citation'; index: number }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string };

type Segment = ParsedSegment | { kind: 'task'; task: LinkableTask };

function leaderboardToLinkable(e: LeaderboardEntry): LinkableTask {
  return {
    taskId: e.id,
    title: e.title,
    status: e.status,
    healthScore: e.healthScore,
    assigneeName: e.assigneeName,
  };
}

/** RAG sources + board tasks — used for title deep-links (not source citations). */
function buildLinkPool(sources: RagSource[], linkTasks: LinkableTask[]): LinkableTask[] {
  const byTitle = new Map<string, LinkableTask>();
  for (const t of linkTasks) {
    byTitle.set(normalizeTitle(t.title), t);
  }
  for (const s of sources) {
    byTitle.set(normalizeTitle(s.title), {
      taskId: s.taskId,
      title: s.title,
      status: s.status,
      healthScore: s.healthScore,
      contentText: s.contentText,
      score: s.score,
    });
  }
  return [...byTitle.values()];
}

type SubLine = { kind: 'why' | 'note'; text: string };

function normalizeTitle(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, '').trim().toLowerCase();
}

function findTaskByTitle(pool: LinkableTask[], title: string): LinkableTask | undefined {
  const norm = normalizeTitle(title);
  return pool.find((t) => normalizeTitle(t.title) === norm);
}

function findSourceByIndex(sources: RagSource[], n: number): RagSource | undefined {
  return sources[n - 1];
}

function titleNeedles(title: string): string[] {
  const base = title.toLowerCase();
  return [base, `"${base}"`, `'${base}'`];
}

function parseInlineSegments(text: string): ParsedSegment[] {
  const parts = text.split(/(\[\d+\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  const out: ParsedSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      out.push({ kind: 'citation', index: Number(cite[1]) });
      continue;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push({ kind: 'bold', value: part.slice(2, -2) });
      continue;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      out.push({ kind: 'italic', value: part.slice(1, -1) });
      continue;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      out.push({ kind: 'code', value: part.slice(1, -1) });
      continue;
    }
    out.push({ kind: 'text', value: part });
  }
  return out;
}

function linkTaskTitles(text: string, pool: LinkableTask[]): Segment[] {
  if (!pool.length || !text) return [{ kind: 'text', value: text }];

  const sorted = [...pool].sort((a, b) => b.title.length - a.title.length);

  type Chunk = { kind: 'text'; value: string } | { kind: 'task'; task: LinkableTask };

  let chunks: Chunk[] = [{ kind: 'text', value: text }];

  for (const task of sorted) {
    const next: Chunk[] = [];
    for (const chunk of chunks) {
      if (chunk.kind !== 'text') {
        next.push(chunk);
        continue;
      }
      const lower = chunk.value.toLowerCase();
      let bestPos = -1;
      let bestLen = 0;
      for (const needle of titleNeedles(task.title)) {
        const pos = lower.indexOf(needle);
        if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
          bestPos = pos;
          bestLen = needle.length;
        }
      }
      if (bestPos === -1) {
        next.push(chunk);
        continue;
      }
      let cursor = 0;
      let pos = bestPos;
      let matchLen = bestLen;
      while (pos !== -1) {
        if (pos > cursor) {
          next.push({ kind: 'text', value: chunk.value.slice(cursor, pos) });
        }
        next.push({ kind: 'task', task });
        cursor = pos + matchLen;
        pos = -1;
        matchLen = 0;
        for (const needle of titleNeedles(task.title)) {
          const p = lower.indexOf(needle, cursor);
          if (p !== -1 && (pos === -1 || p < pos)) {
            pos = p;
            matchLen = needle.length;
          }
        }
      }
      if (cursor < chunk.value.length) {
        next.push({ kind: 'text', value: chunk.value.slice(cursor) });
      }
    }
    chunks = next;
  }

  return chunks;
}

function expandSegments(raw: string, pool: LinkableTask[]): Segment[] {
  const parsed = parseInlineSegments(raw);
  const out: Segment[] = [];

  for (const seg of parsed) {
    if (seg.kind === 'citation') {
      out.push(seg);
      continue;
    }
    if (seg.kind === 'bold') {
      const match = findTaskByTitle(pool, seg.value);
      if (match) {
        out.push({ kind: 'task', task: match });
      } else {
        out.push(seg);
      }
      continue;
    }
    if (seg.kind === 'italic') {
      const inner = seg.value.replace(/^["']|["']$/g, '');
      const match = findTaskByTitle(pool, inner);
      if (match) {
        out.push({ kind: 'task', task: match });
      } else {
        out.push(seg);
      }
      continue;
    }
    if (seg.kind === 'text') {
      out.push(...linkTaskTitles(seg.value, pool));
      continue;
    }
    out.push(seg);
  }
  return out;
}

function CitationChip({
  index,
  source,
  onOpen,
}: {
  index: number;
  source?: RagSource;
  onOpen: (source: RagSource, idx: number) => void;
}) {
  if (!source) {
    return (
      <span className="inline-flex rounded-md bg-white/8 px-1.5 py-px text-[11px] tabular-nums text-pulse-muted">
        [{index}]
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(source, index - 1)}
      className="pulse-answer-citation mx-0.5"
      title={source.title}
      aria-label={`Source ${index}: ${source.title}`}
    >
      [{index}]
    </button>
  );
}

function TaskLink({
  task,
  label,
  onOpen,
}: {
  task: LinkableTask;
  label: string;
  onOpen: (task: LinkableTask) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="pulse-answer-tasklink group/tasklink mx-0.5 inline-flex items-center gap-1"
      title={`View task: ${task.title}`}
    >
      <span>{label}</span>
      <svg
        className="h-3 w-3 shrink-0 text-pulse-accent opacity-0 transition-all duration-200 group-hover/tasklink:translate-x-0.5 group-hover/tasklink:opacity-100"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}

function InlineContent({
  text,
  sources,
  pool,
  onOpenTask,
  onOpenCitation,
}: {
  text: string;
  sources: RagSource[];
  pool: LinkableTask[];
  onOpenTask: (task: LinkableTask) => void;
  onOpenCitation: (source: RagSource, idx: number) => void;
}) {
  const segments = expandSegments(text, pool);
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'citation': {
            const source = findSourceByIndex(sources, seg.index);
            return (
              <CitationChip
                key={i}
                index={seg.index}
                source={source}
                onOpen={onOpenCitation}
              />
            );
          }
          case 'task':
            return (
              <TaskLink
                key={i}
                task={seg.task}
                label={seg.task.title}
                onOpen={onOpenTask}
              />
            );
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-white">
                {seg.value}
              </strong>
            );
          case 'italic':
            return (
              <em key={i} className="italic text-slate-200">
                {seg.value.replace(/^["']|["']$/g, '')}
              </em>
            );
          case 'code':
            return (
              <code
                key={i}
                className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200"
              >
                {seg.value}
              </code>
            );
          default:
            return <span key={i}>{seg.value}</span>;
        }
      })}
    </>
  );
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function parseAssignee(line: string): string | undefined {
  const labeled = line.match(/·\s*assignee\s+(?:\*\*)?([^·\n*]+?)(?:\*\*)?(?:\s*·|$)/i);
  if (labeled) return labeled[1].trim();
  const bold = line.match(/assignee\s+\*\*([^*]+)\*\*/i);
  if (bold) return bold[1].trim();
  return undefined;
}

function parseTaskRow(line: string): {
  health: number;
  status?: string;
  assignee?: string;
} | null {
  const healthMatch = line.match(/health\s+(?:\*\*)?(\d+)(?:\*\*)?(?:\/100)?/i);
  if (!healthMatch) return null;
  const statusMatch = line.match(/`([a-z_]+)`/);
  return {
    health: Number(healthMatch[1]),
    status: statusMatch?.[1],
    assignee: parseAssignee(line),
  };
}

/** Drop inline health/status/assignee tokens when those render as chips. */
function stripTaskMeta(line: string): string {
  return line
    .replace(/\s*·\s*health\s+(?:\*\*)?\d+(?:\*\*)?(?:\/100)?/gi, '')
    .replace(/\s*·\s*`[a-z_]+`/gi, '')
    .replace(/\s*·\s*assignee\s+(?:\*\*)?[^·\n*]+?(?:\*\*)?(?=\s*·|$)/gi, '')
    .replace(/\bassignee\s+\*\*[^*]+\*\*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*·\s*$/g, '')
    .trim();
}

function findPoolAssignee(main: string, pool: LinkableTask[]): string | undefined {
  const bold = main.match(/\*\*([^*]+)\*\*/);
  const candidate = bold?.[1] ?? main;
  const task = findTaskByTitle(pool, candidate);
  return task?.assigneeName ?? undefined;
}

function HealthBadge({ score, band }: { score: number; band: HealthColor }) {
  return (
    <span
      className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ring-inset ${healthChipClasses[band]}`}
      aria-label={`Health score ${score}`}
    >
      {score}
    </span>
  );
}

function AssigneeRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <UserAvatar name={name} size="sm" />
      <span className="truncate text-[11px] font-medium text-slate-400">{name}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
      {formatStatusLabel(status)}
    </span>
  );
}

function splitItemSubs(line: string): { main: string; subs: SubLine[] } {
  const parts = line.split('\n');
  const subs: SubLine[] = [];
  for (const part of parts.slice(1)) {
    if (part.startsWith('>')) {
      subs.push({ kind: 'why', text: part.replace(/^>\s?/, '') });
    } else {
      subs.push({ kind: 'note', text: part });
    }
  }
  return { main: parts[0], subs };
}

function isBulletLine(line: string): boolean {
  const t = line.trim();
  return /^[-*•]\s+/.test(t) || /^→\s+/.test(t) || /^->\s+/.test(t);
}

function isNumberedLine(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function isContinuationLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\s{2,}\S/.test(line)) return true;
  return /^[→>-]\s*(Why|why)\b/.test(t);
}

function isBlockquoteLine(line: string): boolean {
  return /^>\s?/.test(line.trim());
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  return /^\*\*[^*]+:\*\*\s*$/.test(t) || /^\*\*[^*]+:\*\*$/.test(t);
}

function stripSectionHeader(line: string): string {
  return line.trim().replace(/^\*\*|\*\*$/g, '').replace(/:$/, '');
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-*•→]\s+/, '').replace(/^->\s+/, '');
}

function stripContinuation(line: string): string {
  return line.trim().replace(/^[→>-]\s*/, '');
}

function stripNumber(line: string): string {
  return line.trim().replace(/^\d+\.\s+/, '');
}

function stripBlockquote(line: string): string {
  return line.trim().replace(/^>\s?/, '');
}

type ListKind = 'bullet' | 'numbered';

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullet'; lines: string[] }
  | { kind: 'numbered'; lines: string[] }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'section'; label: string };

function isListKind(kind: Block['kind']): kind is ListKind {
  return kind === 'bullet' || kind === 'numbered';
}

function nextNonEmpty(lines: string[], from: number): string | null {
  for (let i = from; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t) return lines[i].trimEnd();
  }
  return null;
}

function continuesList(line: string, listKind: ListKind): boolean {
  if (listKind === 'numbered') {
    return isNumberedLine(line) || isContinuationLine(line) || isBlockquoteLine(line);
  }
  return isBulletLine(line) || isContinuationLine(line) || isBlockquoteLine(line);
}

function attachToList(cur: Extract<Block, { kind: ListKind }>, line: string): void {
  const last = cur.lines.length - 1;
  if (isBlockquoteLine(line)) {
    cur.lines[last] += `\n>${stripBlockquote(line)}`;
  } else {
    cur.lines[last] += `\n${stripContinuation(line)}`;
  }
}

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  const pushLine = (kind: Block['kind'], line: string) => {
    const cur = current as Block | null;
    if (cur && cur.kind === kind && kind !== 'section') {
      (cur as Extract<Block, { kind: 'paragraph' | ListKind | 'blockquote' }>).lines.push(
        line,
      );
      return;
    }
    flush();
    if (kind === 'section') {
      current = { kind: 'section', label: line };
    } else {
      current = { kind, lines: [line] } as Block;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      const cur = current as Block | null;
      const upcoming = nextNonEmpty(lines, i + 1);
      if (cur && upcoming && isListKind(cur.kind) && continuesList(upcoming, cur.kind)) {
        continue;
      }
      flush();
      continue;
    }

    const cur = current as Block | null;
    if (cur && isListKind(cur.kind)) {
      if (isContinuationLine(line) || isBlockquoteLine(line)) {
        attachToList(cur as Extract<Block, { kind: ListKind }>, line);
        continue;
      }
    }

    if (isSectionHeader(line)) {
      pushLine('section', stripSectionHeader(line));
    } else if (isBlockquoteLine(line)) {
      pushLine('blockquote', stripBlockquote(line));
    } else if (isBulletLine(line)) {
      pushLine('bullet', stripBullet(line));
    } else if (isNumberedLine(line)) {
      pushLine('numbered', stripNumber(line));
    } else {
      pushLine('paragraph', line);
    }
  }
  flush();

  return mergeAdjacentListBlocks(blocks);
}

function mergeAdjacentListBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    const prev = out[out.length - 1];
    if (prev && isListKind(prev.kind) && isListKind(block.kind) && prev.kind === block.kind) {
      prev.lines.push(...block.lines);
    } else {
      out.push(block);
    }
  }
  return out;
}

type AnswerRenderCtx = {
  sources: RagSource[];
  pool: LinkableTask[];
  onOpenTask: (task: LinkableTask) => void;
  onOpenCitation: (source: RagSource, idx: number) => void;
};

function ListSubs({ subs, ctx }: { subs: SubLine[]; ctx: AnswerRenderCtx }) {
  if (!subs.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {subs.map((sub, j) =>
        sub.kind === 'why' ? (
          <div key={j} className="pulse-answer-why">
            <InlineContent
              text={sub.text}
              sources={ctx.sources}
              pool={ctx.pool}
              onOpenTask={ctx.onOpenTask}
              onOpenCitation={ctx.onOpenCitation}
            />
          </div>
        ) : (
          <div key={j} className="flex gap-2 text-[13px] text-slate-400">
            <span className="shrink-0 text-pulse-muted" aria-hidden>
              →
            </span>
            <span>
              <InlineContent
                text={sub.text}
                sources={ctx.sources}
                pool={ctx.pool}
                onOpenTask={ctx.onOpenTask}
                onOpenCitation={ctx.onOpenCitation}
              />
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function TaskCardBody({
  main,
  subs,
  ctx,
}: {
  main: string;
  subs: SubLine[];
  ctx: AnswerRenderCtx;
}) {
  const row = parseTaskRow(main)!;
  const band = healthColor(row.health);
  const display = stripTaskMeta(main);
  const assignee = row.assignee ?? findPoolAssignee(main, ctx.pool);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-200">
          <InlineContent
            text={display}
            sources={ctx.sources}
            pool={ctx.pool}
            onOpenTask={ctx.onOpenTask}
            onOpenCitation={ctx.onOpenCitation}
          />
        </p>
        <HealthBadge score={row.health} band={band} />
      </div>

      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/5"
        aria-hidden
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${healthBarClasses[band]}`}
          style={{ width: `${row.health}%` }}
        />
      </div>

      {assignee ? (
        <div className="mt-2.5">
          <AssigneeRow name={assignee} />
        </div>
      ) : null}

      {row.status ? (
        <div className={`${assignee ? 'mt-1.5' : 'mt-2.5'}`}>
          <StatusBadge status={row.status} />
        </div>
      ) : null}

      <ListSubs subs={subs} ctx={ctx} />
    </div>
  );
}

function ListItemBody({ main, ctx }: { main: string; ctx: AnswerRenderCtx }) {
  return (
    <InlineContent
      text={main}
      sources={ctx.sources}
      pool={ctx.pool}
      onOpenTask={ctx.onOpenTask}
      onOpenCitation={ctx.onOpenCitation}
    />
  );
}

function renderListBlock(
  block: Extract<Block, { kind: 'bullet' | 'numbered' }>,
  key: number,
  ctx: AnswerRenderCtx,
): ReactNode {
  const Tag = block.kind === 'numbered' ? 'ol' : 'ul';

  return (
    <Tag key={key} className="pulse-answer-list space-y-2.5">
      {block.lines.map((line, i) => {
        const { main, subs } = splitItemSubs(line);
        const row = parseTaskRow(main);
        if (row) {
          return (
            <li key={i} className="pulse-answer-list-card">
              <TaskCardBody main={main} subs={subs} ctx={ctx} />
            </li>
          );
        }

        return (
          <li
            key={i}
            className="flex gap-2.5 text-sm leading-relaxed text-slate-300"
          >
            {block.kind === 'numbered' ? (
              <span className="pulse-answer-list-index">{i + 1}</span>
            ) : (
              <span className="pulse-answer-list-dot" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <ListItemBody main={main} ctx={ctx} />
              <ListSubs subs={subs} ctx={ctx} />
            </div>
          </li>
        );
      })}
    </Tag>
  );
}

function renderBlock(block: Block, key: number, ctx: AnswerRenderCtx): ReactNode {
  switch (block.kind) {
    case 'section':
      return (
        <h4 key={key} className="text-[11px] font-semibold uppercase tracking-wider text-pulse-glow">
          {block.label}
        </h4>
      );
    case 'blockquote':
      return (
        <blockquote key={key} className="pulse-answer-quote">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <InlineContent
                text={line}
                sources={ctx.sources}
                pool={ctx.pool}
                onOpenTask={ctx.onOpenTask}
                onOpenCitation={ctx.onOpenCitation}
              />
            </span>
          ))}
        </blockquote>
      );
    case 'bullet':
    case 'numbered':
      return renderListBlock(block, key, ctx);
    default:
      return (
        <p key={key} className="text-sm leading-relaxed text-slate-300">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <InlineContent
                text={line}
                sources={ctx.sources}
                pool={ctx.pool}
                onOpenTask={ctx.onOpenTask}
                onOpenCitation={ctx.onOpenCitation}
              />
            </span>
          ))}
        </p>
      );
  }
}

/** Rich formatting for streamed LLM answers with task deep-links. */
export function FormattedAnswer({
  text,
  sources = [],
  linkTasks = [],
}: {
  text: string;
  sources?: RagSource[];
  /** Board tasks for deep-links (health snapshot / leaderboard), beyond RAG sources. */
  linkTasks?: LinkableTask[];
}) {
  const { openTask } = useTaskDetail();
  const pool = buildLinkPool(sources, linkTasks);

  const ctx: AnswerRenderCtx = {
    sources,
    pool,
    onOpenTask: (task) => {
      openTask(task.taskId, {
        contentText: task.contentText,
        score: task.score,
        label: task.title,
      });
    },
    onOpenCitation: (source, idx) => {
      openTask(source.taskId, {
        contentText: source.contentText,
        score: source.score,
        label: `Source #${idx + 1}`,
      });
    },
  };

  const blocks = parseBlocks(text);

  return (
    <div className="space-y-3.5">
      {blocks.map((block, i) => renderBlock(block, i, ctx))}
    </div>
  );
}

export { leaderboardToLinkable };
