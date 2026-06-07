'use client';

import type { User } from '@/lib/api';
import { logout } from '@/lib/auth';
import { BOARD_URL } from '@/lib/config';

interface Props {
  user: User;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pulse-accent to-pulse-accent-dim text-[10px] font-semibold text-white ring-1 ring-white/15"
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Header({ user }: Props) {
  const boardLink =
    user.role !== 'pulse-viewer' ? (
      <a href={BOARD_URL} className="pulse-btn-secondary hidden px-3 py-1.5 text-xs sm:inline-flex">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
        Board
      </a>
    ) : null;

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-white/6 bg-pulse-panel/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pulse-accent to-pulse-accent-dim shadow-lg shadow-pulse-accent/25">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
            Pulse Intel
          </h1>
          <p className="text-[10px] text-pulse-muted sm:text-xs">
            Live feed · leaderboard · momentum · AI
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {boardLink}
        <div className="hidden items-center gap-2 sm:flex">
          <UserAvatar name={user.displayName} />
          <div className="text-right">
            <p className="text-sm font-medium text-white">{user.displayName}</p>
            <p className="text-[10px] text-pulse-muted">{user.role}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="pulse-btn-ghost">
          Sign out
        </button>
      </div>
    </header>
  );
}
