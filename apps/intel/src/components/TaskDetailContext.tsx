'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { TaskDetailDrawer } from './TaskDetailDrawer';

export interface TaskDetailHighlight {
  contentText?: string;
  score?: number;
  label?: string;
}

interface TaskDetailState {
  taskId: string | null;
  highlight: TaskDetailHighlight | null;
}

interface TaskDetailContextValue {
  openTask: (taskId: string, highlight?: TaskDetailHighlight) => void;
  closeTask: () => void;
  isOpen: boolean;
}

const TaskDetailContext = createContext<TaskDetailContextValue | null>(null);

export function TaskDetailProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskDetailState>({
    taskId: null,
    highlight: null,
  });

  const openTask = useCallback(
    (taskId: string, highlight?: TaskDetailHighlight) => {
      setState({ taskId, highlight: highlight ?? null });
    },
    [],
  );

  const closeTask = useCallback(() => {
    setState({ taskId: null, highlight: null });
  }, []);

  const value = useMemo(
    () => ({
      openTask,
      closeTask,
      isOpen: state.taskId !== null,
    }),
    [openTask, closeTask, state.taskId],
  );

  return (
    <TaskDetailContext.Provider value={value}>
      {children}
      {state.taskId && (
        <TaskDetailDrawer
          taskId={state.taskId}
          highlight={state.highlight}
          onClose={closeTask}
        />
      )}
    </TaskDetailContext.Provider>
  );
}

export function useTaskDetail() {
  const ctx = useContext(TaskDetailContext);
  if (!ctx) {
    throw new Error('useTaskDetail must be used within TaskDetailProvider');
  }
  return ctx;
}
