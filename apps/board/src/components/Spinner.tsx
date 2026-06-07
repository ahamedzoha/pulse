interface Props {
  label?: string;
  size?: 'sm' | 'md';
}

export function Spinner({ label, size = 'md' }: Props) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8';
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div
        className={`${dim} animate-[pulse-spin_0.7s_linear_infinite] rounded-full border-2 border-white/10 border-t-pulse-accent`}
      />
      {label && <p className="text-sm text-pulse-muted">{label}</p>}
    </div>
  );
}
