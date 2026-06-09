import type {
  ActivityFeedItem,
  IntelChatTurn,
  IntelTaskDetail,
  Momentum2D,
  Role,
} from '@pulse/shared-types';
import { API_URL } from './config';
import { getToken } from './auth';

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}

export interface LeaderboardEntry {
  id: string;
  title: string;
  status: string;
  healthScore: number;
  assigneeName: string | null;
  lastActivityAt: string;
}

export interface MomentumSnapshot {
  average: number;
  percentage: number;
  eventCount: number;
}

export interface RagSource {
  taskId: string;
  title: string;
  status: string;
  /** Live health at query time; absent on older persisted chat turns. */
  healthScore?: number;
  contentText: string;
  score: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function fetchMe(): Promise<User> {
  return apiFetch<{
    id: string;
    displayName: string;
    email: string;
    role: Role;
  }>('/auth/me');
}

export function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch('/intel/leaderboard');
}

export function fetchTaskDetail(taskId: string): Promise<IntelTaskDetail> {
  return apiFetch(`/intel/tasks/${taskId}`);
}

export function fetchMomentum(): Promise<MomentumSnapshot> {
  return apiFetch('/intel/momentum');
}

export type { Momentum2D };

/** Team affect on the valence × energy plane (24h). */
export function fetchMomentum2d(): Promise<Momentum2D> {
  return apiFetch('/intel/momentum2d');
}

export type FeedItem = ActivityFeedItem;

export type { IntelChatTurn };

/** Load recent activity (hydrates feed on page load; SSE only streams new events). */
export function fetchRecentFeed(limit = 50): Promise<FeedItem[]> {
  return apiFetch(`/intel/feed/recent?limit=${limit}`);
}

/** Persisted Intel AI chat history for the signed-in user. */
export function fetchChatHistory(): Promise<IntelChatTurn[]> {
  return apiFetch('/intel/chat');
}

/** Delete all persisted chat turns for the signed-in user. */
export function clearChatHistory(): Promise<{ ok: boolean }> {
  return apiFetch('/intel/chat', { method: 'DELETE' });
}

type QueryChunk =
  | { type: 'turn'; id: string }
  | { type: 'sources'; sources: RagSource[] }
  | { type: 'token'; value: string }
  | { type: 'done'; turnId?: string }
  | { type: 'error'; message: string };

/** Stream RAG response chunks from POST /intel/query. */
export async function* streamQuery(
  question: string,
): AsyncGenerator<QueryChunk> {
  const token = getToken();
  const res = await fetch(`${API_URL}/intel/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) {
    yield { type: 'error', message: await res.text() };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const msg = JSON.parse(line.slice(5).trim()) as QueryChunk;
      yield msg;
    }
  }
}
