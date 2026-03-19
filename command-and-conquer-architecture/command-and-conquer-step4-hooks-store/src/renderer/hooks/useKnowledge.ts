import { useIPCQuery } from './useIPC';
import type { SourceDocument, SolvedIssue, DecisionAnchor } from '../../main/types';

declare global {
  interface Window {
    api: any;
  }
}

export function useDocs(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<SourceDocument[]>(window.api.knowledge.listDocs, projectId);

  return {
    docs: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}

export function useDoc(projectId: string, docId: string) {
  const { data, loading, error, execute } = useIPCQuery<SourceDocument>(window.api.knowledge.getDoc, projectId, docId);

  return {
    doc: data,
    loading,
    error,
    refresh: () => execute(projectId, docId),
  };
}

export function useSolvedIssues(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<SolvedIssue[]>(window.api.knowledge.listSolved, projectId);

  return {
    solvedIssues: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}

export function useAnchors(projectId: string) {
  const { data, loading, error, execute } = useIPCQuery<DecisionAnchor[]>(window.api.knowledge.listAnchors, projectId);

  return {
    anchors: data ?? [],
    loading,
    error,
    refresh: () => execute(projectId),
  };
}
