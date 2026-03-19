import { useIPC, useIPCQuery } from './useIPC';
import type { Run } from '../../main/types';

declare global {
  interface Window {
    api: any;
  }
}

export function useRuns(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<Run[]>(window.api.runs.list, projectId);

  return {
    runs: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}

export function useRun(projectId: string, runId: string) {
  const { data, loading, error, execute } = useIPCQuery<Run>(window.api.runs.get, projectId, runId);

  return {
    run: data,
    loading,
    error,
    refresh: () => execute(projectId, runId),
  };
}

export function useImportRun() {
  const { loading, error, execute } = useIPC<{ run: Run; staleDocIds: string[] }>(window.api.runs.import);

  return {
    importRun: (projectId: string, folderPath: string) => execute(projectId, folderPath),
    loading,
    error,
  };
}
