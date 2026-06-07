'use client';

import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'md' | 'lg';
}

export function Modal({ title, onClose, children, maxWidth = 'lg' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const maxW = maxWidth === 'md' ? 'max-w-md' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={`pulse-modal-in relative flex max-h-[90vh] w-full ${maxW} flex-col overflow-hidden rounded-2xl border border-white/10 bg-pulse-panel shadow-2xl shadow-black/50`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/6 px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-pulse-muted transition-colors duration-200 hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
