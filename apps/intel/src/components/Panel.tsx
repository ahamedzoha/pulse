import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  /** Extra classes on the outer shell */
  className?: string;
  /** If true, children manage their own scroll (default: flex col + min-h-0) */
  bodyClassName?: string;
}

/** Shared Intel panel chrome — glass card, fixed header, scrollable body. */
export function Panel({
  title,
  subtitle,
  icon,
  trailing,
  children,
  className = '',
  bodyClassName = 'flex min-h-0 flex-1 flex-col overflow-hidden',
}: Props) {
  return (
    <section
      className={`pulse-glass flex h-full min-h-0 flex-col overflow-hidden transition-shadow duration-300 hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-[10px] text-pulse-muted">{subtitle}</p>
            )}
          </div>
        </div>
        {trailing}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
