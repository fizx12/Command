import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTask, useUpdateTask } from '../hooks/useTasks';
import { useRuns } from '../hooks/useRuns';
import TaskDetail from '../components/tasks/TaskDetail';
import ClosureModal from '../components/modals/ClosureModal';
import DecisionAnchorGate from '../components/modals/DecisionAnchorGate';
import Header from '../components/layout/Header';

export default function ReviewPanel() {
  const { projectId = '', taskId = '' } = useParams();
  const navigate = useNavigate();
  const { task } = useTask(projectId, taskId);
  const { runs = [] } = useRuns(projectId);
  const updateTask = useUpdateTask(projectId);

  const [showClosure, setShowClosure] = useState(false);
  const [showAnchorGate, setShowAnchorGate] = useState(false);

  const linkedRuns = useMemo(() => {
    if (!task?.linkedRunIds?.length) {
      return [];
    }

    return runs.filter((run: { id: string }) => task.linkedRunIds.includes(run.id));
  }, [runs, task]);

  const latestRun = linkedRuns[0] ?? null;

  const handleStatusChange = async (status: 'approved' | 'active' | 'blocked') => {
    if (!taskId) {
      return;
    }

    await updateTask(taskId, { status });

    if (status === 'approved') {
      setShowClosure(true);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <Header title={`Review: ${task?.title ?? 'Task'}`} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-lg border border-border bg-surface-alt p-5">
          {task ? (
            <TaskDetail task={task} />
          ) : (
            <div className="rounded-lg bg-surface p-6 text-sm text-text-secondary">
              Task not found.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface-alt p-5">
            <h2 className="mb-3 text-base font-semibold text-text-primary">Latest Run</h2>
            {latestRun ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-text-primary">Summary</div>
                  <p className="mt-1 text-sm text-text-secondary">{latestRun.summary || 'No summary available.'}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">Changed Files</div>
                  <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                    {(latestRun.changedFiles || []).map(
                      (file: { path: string; changeType?: string }, index: number) => (
                        <li key={`${file.path}-${index}`} className="rounded-md bg-surface px-3 py-2">
                          <div className="font-medium text-text-primary">{file.path}</div>
                          <div className="text-xs uppercase tracking-wide text-text-secondary">
                            {file.changeType || 'modified'}
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary">No linked runs available.</div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-alt p-5">
            <h2 className="mb-4 text-base font-semibold text-text-primary">Review Actions</h2>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleStatusChange('approved')}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Revise
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('blocked')}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Reject
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/tasks?create=1`)}
              className="mt-4 w-full rounded-md bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
            >
              Create Follow-up Task
            </button>
          </div>
        </div>
      </div>

      <ClosureModal
        isOpen={showClosure}
        task={task}
        onClose={() => setShowClosure(false)}
        onConfirm={() => {
          setShowClosure(false);
          setShowAnchorGate(true);
        }}
      />

      <DecisionAnchorGate
        isOpen={showAnchorGate}
        task={task}
        onClose={() => setShowAnchorGate(false)}
        onConfirm={() => setShowAnchorGate(false)}
      />
    </div>
  );
}
