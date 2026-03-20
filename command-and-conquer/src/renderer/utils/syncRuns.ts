import type { Run } from '../../main/types';

/**
 * Deduplicates runs within the scope of a single Task ID.
 * All runs are treated as children of the taskId.
 */
export function syncRuns(runs: Run[], taskId?: string): Run[] {
  const seenIds = new Set<string>();
  
  return runs
    .filter(run => !taskId || run.taskId === taskId)
    .filter(run => {
      if (!seenIds.has(run.id)) {
        seenIds.add(run.id);
        return true;
      }
      return false;
    });
}
