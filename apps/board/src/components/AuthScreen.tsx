'use client';

import type { ReactNode } from 'react';
import { getToken, logout, signInAsDifferentUser } from '@/lib/auth';

export interface AuthScreenAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

interface Props {
  appLabel: string;
  title: string;
  description: ReactNode;
  user?: { displayName: string; role: string };
  actions?: AuthScreenAction[];
  accent?: 'board' | 'intel';
}

export function AuthScreen({
  appLabel,
  title,
  description,
  user,
  actions = [],
}: Props) {
  const hasToken = !!getToken();

  return (
    <main className="flex h-dvh flex-col items-center justify-center p-6">
      <div className="pulse-fade-in pulse-glass w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pulse-accent to-pulse-accent-dim shadow-xl shadow-pulse-accent/30">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        </div>

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-pulse-muted">
          {appLabel}
        </p>
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        <div className="mt-3 text-sm leading-relaxed text-pulse-muted">{description}</div>

        {user && (
          <p className="mt-5 rounded-xl border border-white/8 bg-pulse-bg/60 px-4 py-3 text-sm">
            <span className="text-pulse-muted">Signed in as </span>
            <span className="font-medium text-white">{user.displayName}</span>
            <span className="text-pulse-muted"> · {user.role}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions.map((a) =>
            a.href ? (
              <a
                key={a.label}
                href={a.href}
                className={a.primary ? 'pulse-btn-primary' : 'pulse-btn-secondary'}
              >
                {a.label}
              </a>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={a.primary ? 'pulse-btn-primary' : 'pulse-btn-secondary'}
              >
                {a.label}
              </button>
            ),
          )}
        </div>

        {hasToken ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-pulse-muted">
            <button
              type="button"
              onClick={signInAsDifferentUser}
              className="cursor-pointer transition-colors duration-200 hover:text-white"
            >
              Sign in as a different user
            </button>
            <span className="text-white/15">·</span>
            <button
              type="button"
              onClick={logout}
              className="cursor-pointer transition-colors duration-200 hover:text-white"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
