import { healthClasses, healthColor } from '@/lib/health';

interface Props {
  score: number;
  showBar?: boolean;
}

export function HealthBadge({ score, showBar = false }: Props) {
  const color = healthColor(score);
  const critical = color === 'red';

  return (
    <span
      className={`inline-flex shrink-0 flex-col items-end gap-1 ${critical ? 'pulse-health-critical rounded-md' : ''}`}
      title={`Health score: ${score}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${healthClasses[color]}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            color === 'green'
              ? 'bg-emerald-400'
              : color === 'amber'
                ? 'bg-amber-400'
                : 'bg-red-400'
          }`}
          aria-hidden
        />
        {score}
      </span>
      {showBar && (
        <span className="h-1 w-12 overflow-hidden rounded-full bg-white/8">
          <span
            className={`block h-full rounded-full transition-all duration-500 ${
              color === 'green'
                ? 'bg-emerald-500'
                : color === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </span>
      )}
    </span>
  );
}
