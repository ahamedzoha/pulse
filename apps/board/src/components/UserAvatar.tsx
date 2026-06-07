function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  name: string;
  size?: 'sm' | 'md';
}

export function UserAvatar({ name, size = 'sm' }: Props) {
  const hue = hashHue(name);
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/15 ${dim}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 55% 35%))`,
      }}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
