import { useIPC, useIPCQuery } from './useIPC';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../main/types';

declare global {
  interface Window {
    api: any;
  }
}

export function useProjects() {
  const { data, loading, error, execute } = useIPCQuery<Project[]>(window.api.projects.list);

  return {
    projects: data ?? [],
    loading,
    error,
    refresh: () => execute(),
  };
}

export function useProject(id: string) {
  const { data, loading, error, execute } = useIPCQuery<Project>(window.api.projects.get, id);

  return {
    project: data,
    loading,
    error,
    refresh: () => execute(id),
  };
}

export function useCreateProject() {
  const { loading, error, execute } = useIPC<Project>(window.api.projects.create);

  return {
    create: (data: CreateProjectInput) => execute(data),
    loading,
    error,
  };
}

export function useUpdateProject() {
  const { loading, error, execute } = useIPC<Project>(window.api.projects.update);

  return {
    update: (id: string, data: UpdateProjectInput) => execute(id, data),
    loading,
    error,
  };
}
