import type {
  IntelTaskEvent,
  Mood,
  Role,
  TaskStatus,
} from '@pulse/shared-types';
import { API_URL } from './config';
import { getToken } from './auth';

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  health_score: number;
  last_activity_at: string;
}

export interface UserOption {
  id: string;
  display_name: string;
  email: string;
  role: Role;
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

export function fetchTasks(): Promise<Task[]> {
  return apiFetch('/tasks');
}

export type TaskEventItem = IntelTaskEvent;

/** Activity history (comments + status/assignee changes) for a task. */
export function fetchTaskEvents(id: string): Promise<TaskEventItem[]> {
  return apiFetch(`/tasks/${id}/events`);
}

export function fetchUsers(): Promise<UserOption[]> {
  return apiFetch('/users');
}

export function createTask(input: {
  title: string;
  description?: string;
  assigneeId?: string;
  mood: Mood;
}): Promise<Task> {
  return apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      mood: input.mood,
    }),
  });
}

export function updateStatus(
  id: string,
  status: TaskStatus,
  mood: Mood,
): Promise<Task> {
  return apiFetch(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, mood }),
  });
}

export function addComment(
  id: string,
  commentText: string,
  mood: Mood,
): Promise<Task> {
  return apiFetch(`/tasks/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ commentText, mood }),
  });
}

export function reassignTask(
  id: string,
  assigneeId: string,
  mood: Mood,
): Promise<Task> {
  return apiFetch(`/tasks/${id}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId, mood }),
  });
}
