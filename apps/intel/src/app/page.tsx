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
        {/*
          Command-center layout (lg+):
          · Top: compact momentum ribbon
          · Left rail (5/12): leaderboard + live feed
          · Right hero (7/12): AI panel — primary surface
          Mobile: AI first, then insights stack
        */}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:gap-4 lg:overflow-hidden lg:p-4">
          <MomentumMeter />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
            <div className="order-1 flex min-h-[min(52vh,520px)] flex-col lg:order-2 lg:col-span-7 lg:min-h-0">
              <AiPanel />
            </div>

            <div className="order-2 grid min-h-0 grid-rows-2 gap-3 max-lg:min-h-[480px] lg:order-1 lg:col-span-5">
              <div className="min-h-0">
                <Leaderboard />
              </div>
              <div className="min-h-0">
                <ActivityFeed />
              </div>
            </div>
          </div>
        </main>
      </div>
    </TaskDetailProvider>
  );
}
