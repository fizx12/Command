import { useIPC, useIPCQuery } from './useIPC';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../main/types';

declare global {
  interface Window {
    api: any;
  }
}

export function useTasks(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<Task[]>(window.api.tasks.list, projectId);

  return {
    tasks: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}

export function useTask(projectId: string, taskId: string) {
  const { data, loading, error, execute } = useIPCQuery<Task>(window.api.tasks.get, projectId, taskId);

  return {
    task: data,
    loading,
    error,
    refresh: () => execute(projectId, taskId),
  };
}

export function useCreateTask() {
  const { loading, error, execute } = useIPC<Task>(window.api.tasks.create);

  return {
    create: (projectId: string, data: CreateTaskInput) => execute(projectId, data),
    loading,
    error,
  };
}

export function useUpdateTask() {
  const { loading, error, execute } = useIPC<Task>(window.api.tasks.update);

  return {
    update: (projectId: string, taskId: string, data: UpdateTaskInput) => execute(projectId, taskId, data),
    loading,
    error,
  };
}
