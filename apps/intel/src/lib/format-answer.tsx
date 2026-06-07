import type { ReactNode } from 'react';

/** Rich inline formatting: **bold**, `code`, and plain text. */
function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function isBulletLine(line: string): boolean {
  return /^[-*•]\s+/.test(line.trim());
}

function isNumberedLine(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[-*•]\s+/, '');
}

function stripNumber(line: string): string {
  return line.trim().replace(/^\d+\.\s+/, '');
}

function renderBlock(block: string, key: number): ReactNode {
  const lines = block.split('\n').filter((l) => l.trim());

  if (lines.length > 0 && lines.every(isBulletLine)) {
    return (
      <ul key={key} className="list-none space-y-1.5 pl-1">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pulse-accent" aria-hidden />
            <span>{formatInline(stripBullet(line))}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (lines.length > 0 && lines.every(isNumberedLine)) {
    return (
      <ol key={key} className="list-none space-y-1.5 pl-1">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
            <span className="shrink-0 tabular-nums text-pulse-accent">{i + 1}.</span>
            <span>{formatInline(stripNumber(line))}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p key={key} className="text-sm leading-relaxed text-slate-300">
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {formatInline(line)}
        </span>
      ))}
    </p>
  );
}

/** Rich formatting for streamed LLM answers. */
export function FormattedAnswer({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
