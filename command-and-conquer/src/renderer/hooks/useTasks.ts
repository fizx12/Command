import { useState, useCallback } from 'react';
import { useIPC, useIPCQuery } from './useIPC';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../main/types';


export function useTasks(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<Task[]>(window?.api?.tasks?.list, projectId);

  return {
    tasks: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}

export function useTask(projectId: string, taskId: string) {
  const { data, loading, error, execute } = useIPCQuery<Task>(window?.api?.tasks?.get, projectId, taskId);

  return {
    task: data,
    loading,
    error,
    refresh: () => execute(projectId, taskId),
  };
}

export function useCreateTask() {
  const { loading, error, execute } = useIPC<Task>(window?.api?.tasks?.create);

  return {
    create: (projectId: string, data: CreateTaskInput) => execute(projectId, data),
    loading,
    error,
  };
}

export function useUpdateTask() {
  const { loading, error, execute } = useIPC<Task>(window?.api?.tasks?.update);

  return {
    update: (projectId: string, taskId: string, data: UpdateTaskInput) => execute(projectId, taskId, data),
    loading,
    error,
  };
}

export function useDeleteTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (projectId: string, taskId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    if (typeof window?.api?.tasks?.delete !== 'function') {
      setError('IPC API not available');
      setLoading(false);
      return false;
    }

    try {
      const result = await window.api.tasks.delete(projectId, taskId);
      if (result?.error) {
        setError(typeof result.message === 'string' ? result.message : 'Unknown IPC error');
        return false;
      }
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown IPC error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    remove,
    loading,
    error,
  };
}
