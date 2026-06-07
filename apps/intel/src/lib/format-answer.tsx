'use client';

import type { ReactNode } from 'react';
import type { RagSource } from '@/lib/api';
import { useTaskDetail } from '@/components/TaskDetailContext';

type ParsedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'citation'; index: number }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string };

type Segment =
  | ParsedSegment
  | { kind: 'task'; source: RagSource; index: number };

function normalizeTitle(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, '').trim().toLowerCase();
}

function findSourceByTitle(sources: RagSource[], title: string): RagSource | undefined {
  const norm = normalizeTitle(title);
  return sources.find((s) => normalizeTitle(s.title) === norm);
}

function findSourceByIndex(sources: RagSource[], n: number): RagSource | undefined {
  return sources[n - 1];
}

/** Split inline markdown into typed segments. */
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

/** Link known task titles inside plain text spans. */
function linkTaskTitles(text: string, sources: RagSource[]): Segment[] {
  if (!sources.length || !text) return [{ kind: 'text', value: text }];

  const sorted = [...sources]
    .map((s, i) => ({ source: s, index: i }))
    .sort((a, b) => b.source.title.length - a.source.title.length);

  type Chunk =
    | { kind: 'text'; value: string }
    | { kind: 'task'; source: RagSource; index: number };

  let chunks: Chunk[] = [{ kind: 'text', value: text }];

  for (const { source, index } of sorted) {
    const next: Chunk[] = [];
    for (const chunk of chunks) {
      if (chunk.kind !== 'text') {
        next.push(chunk);
        continue;
      }
      const lower = chunk.value.toLowerCase();
      const needle = source.title.toLowerCase();
      let cursor = 0;
      let pos = lower.indexOf(needle, cursor);
      if (pos === -1) {
        next.push(chunk);
        continue;
      }
      while (pos !== -1) {
        if (pos > cursor) {
          next.push({ kind: 'text', value: chunk.value.slice(cursor, pos) });
        }
        next.push({
          kind: 'task',
          source,
          index,
        });
        cursor = pos + source.title.length;
        pos = lower.indexOf(needle, cursor);
      }
      if (cursor < chunk.value.length) {
        next.push({ kind: 'text', value: chunk.value.slice(cursor) });
      }
    }
    chunks = next;
  }

  return chunks;
}

function expandSegments(raw: string, sources: RagSource[]): Segment[] {
  const parsed = parseInlineSegments(raw);
  const out: Segment[] = [];

  for (const seg of parsed) {
    if (seg.kind === 'citation') {
      out.push(seg);
      continue;
    }
    if (seg.kind === 'bold') {
      const match = findSourceByTitle(sources, seg.value);
      if (match) {
        const idx = sources.indexOf(match);
        out.push({ kind: 'task', source: match, index: idx });
      } else {
        out.push(seg);
      }
      continue;
    }
    if (seg.kind === 'italic') {
      const inner = seg.value.replace(/^["']|["']$/g, '');
      const match = findSourceByTitle(sources, inner);
      if (match) {
        out.push({ kind: 'task', source: match, index: sources.indexOf(match) });
      } else {
        out.push(seg);
      }
      continue;
    }
    if (seg.kind === 'text') {
      out.push(...linkTaskTitles(seg.value, sources));
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
  source,
  index,
  label,
  onOpen,
}: {
  source: RagSource;
  index: number;
  label: string;
  onOpen: (source: RagSource, idx: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(source, index)}
      className="pulse-answer-tasklink group/tasklink mx-0.5 inline-flex items-center gap-1"
      title={`View task: ${source.title}`}
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
  onOpen,
}: {
  text: string;
  sources: RagSource[];
  onOpen: (source: RagSource, idx: number) => void;
}) {
  const segments = expandSegments(text, sources);
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
                onOpen={onOpen}
              />
            );
          }
          case 'task':
            return (
              <TaskLink
                key={i}
                source={seg.source}
                index={seg.index}
                label={seg.source.title}
                onOpen={onOpen}
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

function isBulletLine(line: string): boolean {
  return /^[-*•]\s+/.test(line.trim());
}

function isNumberedLine(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function isBlockquoteLine(line: string): boolean {
  return /^>\s?/.test(line.trim());
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-*•]\s+/, '');
}

function stripNumber(line: string): string {
  return line.trim().replace(/^\d+\.\s+/, '');
}

function stripBlockquote(line: string): string {
  return line.trim().replace(/^>\s?/, '');
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullet'; lines: string[] }
  | { kind: 'numbered'; lines: string[] }
  | { kind: 'blockquote'; lines: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  const pushLine = (kind: Block['kind'], line: string) => {
    if (current?.kind === kind) {
      current.lines.push(line);
      return;
    }
    flush();
    current = { kind, lines: [line] } as Block;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isBlockquoteLine(line)) pushLine('blockquote', stripBlockquote(line));
    else if (isBulletLine(line)) pushLine('bullet', stripBullet(line));
    else if (isNumberedLine(line)) pushLine('numbered', stripNumber(line));
    else pushLine('paragraph', line);
  }
  flush();
  return blocks;
}

function renderBlock(
  block: Block,
  key: number,
  sources: RagSource[],
  onOpen: (source: RagSource, idx: number) => void,
): ReactNode {
  switch (block.kind) {
    case 'blockquote':
      return (
        <blockquote key={key} className="pulse-answer-quote">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <InlineContent text={line} sources={sources} onOpen={onOpen} />
            </span>
          ))}
        </blockquote>
      );
    case 'bullet':
      return (
        <ul key={key} className="list-none space-y-2 pl-0.5">
          {block.lines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-accent shadow-sm shadow-pulse-accent/40"
                aria-hidden
              />
              <span>
                <InlineContent text={line} sources={sources} onOpen={onOpen} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'numbered':
      return (
        <ol key={key} className="list-none space-y-2 pl-0.5">
          {block.lines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
              <span className="shrink-0 tabular-nums font-medium text-pulse-accent">
                {i + 1}.
              </span>
              <span>
                <InlineContent text={line} sources={sources} onOpen={onOpen} />
              </span>
            </li>
          ))}
        </ol>
      );
    default:
      return (
        <p key={key} className="text-sm leading-relaxed text-slate-300">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              <InlineContent text={line} sources={sources} onOpen={onOpen} />
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
}: {
  text: string;
  sources?: RagSource[];
}) {
  const { openTask } = useTaskDetail();

  const onOpen = (source: RagSource, idx: number) => {
    openTask(source.taskId, {
      contentText: source.contentText,
      score: source.score,
      label: `Source #${idx + 1}`,
    });
  };

  const blocks = parseBlocks(text);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => renderBlock(block, i, sources, onOpen))}
    </div>
  );
}
