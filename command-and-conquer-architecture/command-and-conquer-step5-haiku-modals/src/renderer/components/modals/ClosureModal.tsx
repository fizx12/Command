import React, { useEffect, useState } from 'react';

interface ClosureModalProps {
  isOpen: boolean;
  taskSize: 'Micro' | 'Standard' | 'Major';
  aiDraftedSummary: string;
  aiDraftedGaps: string[];
  onConfirm: (closure: {
    resolution: string;
    solvedSummary: string;
    remainingGaps: string[];
    sourceDocsUpdated: boolean;
    solvedIssueCreated: boolean;
  }) => void;
  onCancel: () => void;
}

export default function ClosureModal({
  isOpen,
  taskSize,
  aiDraftedSummary,
  aiDraftedGaps,
  onConfirm,
  onCancel,
}: ClosureModalProps) {
  const [resolution, setResolution] = useState('');
  const [solvedSummary, setSolvedSummary] = useState(aiDraftedSummary);
  const [remainingGaps, setRemainingGaps] = useState<string[]>(aiDraftedGaps);
  const [newGap, setNewGap] = useState('');
  const [sourceDocsUpdated, setSourceDocsUpdated] = useState(false);
  const [solvedIssueCreated, setSolvedIssueCreated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResolution('');
      setSolvedSummary(aiDraftedSummary);
      setRemainingGaps(aiDraftedGaps);
      setNewGap('');
      setSourceDocsUpdated(false);
      setSolvedIssueCreated(false);
    }
  }, [aiDraftedGaps, aiDraftedSummary, isOpen, taskSize]);

  if (!isOpen) {
    return null;
  }

  const title =
    taskSize === 'Micro' ? 'Quick Close' : taskSize === 'Standard' ? 'Close Task' : 'Full Closure';

  const showGaps = taskSize !== 'Micro';
  const showSourceDocs = taskSize !== 'Micro';
  const showSolvedIssue = taskSize === 'Major';
  const hasOpenGaps = remainingGaps.some((gap) => gap.trim().length > 0);

  const addGap = () => {
    const trimmed = newGap.trim();
    if (!trimmed) {
      return;
    }

    setRemainingGaps((current) => [...current, trimmed]);
    setNewGap('');
  };

  const removeGap = (index: number) => {
    setRemainingGaps((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-surface p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Task Closure
            </p>
            <h2 id="closure-modal-title" className="text-xl font-semibold text-text-primary">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-alt hover:text-text-primary"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="closure-resolution" className="mb-2 block text-sm font-medium text-text-primary">
              Resolution
            </label>
            <input
              id="closure-resolution"
              type="text"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              className="w-full rounded-lg border border-surface-alt bg-surface-alt px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Summarize how the task ended"
            />
          </div>

          <div>
            <label htmlFor="closure-summary" className="mb-2 block text-sm font-medium text-text-primary">
              Summary
            </label>
            <textarea
              id="closure-summary"
              value={solvedSummary}
              onChange={(event) => setSolvedSummary(event.target.value)}
              rows={taskSize === 'Micro' ? 3 : 5}
              className="w-full rounded-lg border border-surface-alt bg-surface-alt px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Summarize the solution"
            />
          </div>

          {showGaps ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-text-primary">Remaining gaps</label>
                <span className="text-xs text-text-secondary">{remainingGaps.length} item(s)</span>
              </div>

              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newGap}
                  onChange={(event) => setNewGap(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addGap();
                    }
                  }}
                  className="flex-1 rounded-lg border border-surface-alt bg-surface-alt px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="Add a remaining gap"
                />
                <button
                  type="button"
                  onClick={addGap}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
                >
                  Add
                </button>
              </div>

              {remainingGaps.length > 0 ? (
                <ul className="space-y-2">
                  {remainingGaps.map((gap, index) => (
                    <li
                      key={`${gap}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-surface-alt px-3 py-2"
                    >
                      <span className="text-sm text-text-primary">{gap}</span>
                      <button
                        type="button"
                        onClick={() => removeGap(index)}
                        className="text-xs text-text-secondary transition hover:text-text-primary"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">No remaining gaps.</p>
              )}
            </div>
          ) : null}

          {showSourceDocs ? (
            <label className="flex items-center gap-3 rounded-lg bg-surface-alt px-3 py-3 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={sourceDocsUpdated}
                onChange={(event) => setSourceDocsUpdated(event.target.checked)}
                className="h-4 w-4 rounded border-surface-alt bg-surface text-accent focus:ring-accent"
              />
              Source docs updated?
            </label>
          ) : null}

          {showSolvedIssue ? (
            <label className="flex items-center gap-3 rounded-lg bg-surface-alt px-3 py-3 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={solvedIssueCreated}
                onChange={(event) => setSolvedIssueCreated(event.target.checked)}
                className="h-4 w-4 rounded border-surface-alt bg-surface text-accent focus:ring-accent"
              />
              Solved issue created?
            </label>
          ) : null}

          {taskSize === 'Major' && hasOpenGaps ? (
            <div className="rounded-lg border border-badge-yellow/30 bg-badge-yellow/10 px-4 py-3 text-sm text-text-primary">
              You have open gaps. Create follow-up tasks?
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() =>
              onConfirm({
                resolution,
                solvedSummary,
                remainingGaps,
                sourceDocsUpdated,
                solvedIssueCreated,
              })
            }
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Confirm Closure
          </button>
        </div>
      </div>
    </div>
  );
}
