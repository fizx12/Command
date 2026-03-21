import React, { useState, useEffect } from 'react';
import type { Run } from '../../../main/types';
import { syncRuns } from '../../utils/syncRuns';
import { tooltipProps } from '../../utils/tooltips';

/**
 * Manages runs strictly as children of a specific Task.
 * The "Force" button triggers a clean sync that replaces the child array.
 */
interface RunManagerProps {
  taskId?: string;
  projectId: string;
}

export const RunManager: React.FC<RunManagerProps> = ({ taskId, projectId }) => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await (window as any).api.runs.list(projectId);
      if (res && res.data) {
        const deduplicated = syncRuns(res.data, taskId);
        setRuns(deduplicated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [taskId, projectId]);

  return (
    <div className="run-manager-container p-4 bg-surface rounded-xl border border-surface-alt">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
          Task Runs ({runs.length})
        </h3>
        {/* Force button: triggers a clean sync of children for the active task */}
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-lg font-bold text-xs shadow-lg shadow-accent/20 hover:opacity-90 disabled:opacity-50 transition-all"
          {...tooltipProps('Refresh task runs')}
        >
          {loading ? 'Refreshing...' : 'Force'}
        </button>
      </div>

      <div className="run-children-list space-y-2">
        {runs.map(run => (
          <div key={run.id} className="run-card p-3 bg-surface-alt/50 rounded-lg border border-surface-alt hover:border-accent transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] text-accent font-bold">{run.id}</span>
              <span className="text-[10px] text-text-secondary">{new Date(run.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-text-primary line-clamp-2 leading-relaxed">
              {run.summary}
            </p>
          </div>
        ))}
        {runs.length === 0 && (
          <div className="py-8 text-center border-2 border-dashed border-surface-alt rounded-lg">
            <p className="text-xs text-text-secondary italic">No runs for this task yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
