'use client';

import { useEffect, useState } from 'react';
import { fetchMe, type User } from '@/lib/api';
import {
  captureTokenFromHash,
  getToken,
  signIn,
  signInAsDifferentUser,
} from '@/lib/auth';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AiPanel } from '@/components/AiPanel';
import { AuthScreen } from '@/components/AuthScreen';
import { Header } from '@/components/Header';
import { Leaderboard } from '@/components/Leaderboard';
import { MomentumMeter } from '@/components/MomentumMeter';
import { Spinner } from '@/components/Spinner';
import { TaskDetailProvider } from '@/components/TaskDetailContext';

export default function IntelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    captureTokenFromHash();
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => setAuthFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <Spinner label="Loading Intel…" />
      </main>
    );
  }

  if (!getToken()) {
    return (
      <AuthScreen
        appLabel="Pulse Intel"
        title="Sign in to continue"
        description="Sign in with Microsoft Entra ID to view the live feed, health leaderboard, momentum meter, and AI panel."
        actions={[{ label: 'Sign in with Microsoft', onClick: signIn, primary: true }]}
      />
    );
  }

  if (authFailed || !user) {
    return (
      <AuthScreen
        appLabel="Pulse Intel"
        title="Session expired"
        description="Your sign-in could not be verified. Sign in again or sign out to use a different account."
        actions={[
          {
            label: 'Sign in again',
            onClick: signInAsDifferentUser,
            primary: true,
          },
        ]}
      />
    );
  }

  return (
    <TaskDetailProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Header user={user} />
        <main className="min-h-0 flex-1 overflow-y-auto p-3 lg:grid lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4 lg:overflow-hidden lg:p-4">
          <div className="mb-3 min-h-[220px] lg:col-span-4 lg:mb-0 lg:h-full lg:min-h-0">
            <MomentumMeter />
          </div>
          <div className="mb-3 min-h-[280px] lg:col-span-8 lg:mb-0 lg:h-full lg:min-h-0">
            <Leaderboard />
          </div>
          <div className="mb-3 min-h-[320px] lg:col-span-5 lg:mb-0 lg:h-full lg:min-h-0">
            <ActivityFeed />
          </div>
          <div className="min-h-[380px] lg:col-span-7 lg:h-full lg:min-h-0">
            <AiPanel />
          </div>
        </main>
      </div>
    </TaskDetailProvider>
  );
}
