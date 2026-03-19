import React, { useEffect, useMemo, useState } from 'react';

interface DecisionAnchorGateProps {
  isOpen: boolean;
  taskId: string;
  aiDraftedSummary: string;
  filesInPlay: string[];
  onConfirm: (anchor: { status: string; summary: string }) => void;
  onCancel?: () => void;
}

const STATUS_OPTIONS = [
  'Solved',
  'Broken',
  'Unsolved',
  'Bug patch',
  'Update',
  'Difficult problem with solution',
] as const;

export default function DecisionAnchorGate({
  isOpen,
  taskId,
  aiDraftedSummary,
  filesInPlay,
  onConfirm,
  onCancel,
}: DecisionAnchorGateProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [editedSummary, setEditedSummary] = useState<string>(aiDraftedSummary);

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus('');
      setEditedSummary(aiDraftedSummary);
    }
  }, [aiDraftedSummary, isOpen]);

  const canConfirm = useMemo(
    () => selectedStatus.trim().length > 0,
    [selectedStatus],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-anchor-title"
      aria-describedby="decision-anchor-description"
      data-task-id={taskId}
    >
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-2xl ring-1 ring-accent/20">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Decision Anchor Required
          </p>
          <h2 id="decision-anchor-title" className="text-xl font-semibold text-text-primary">
            Before you move on...
          </h2>
          <p id="decision-anchor-description" className="mt-2 text-sm text-text-secondary">
            Classify the current state before starting a new task, switching projects, or opening a new prompt.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {STATUS_OPTIONS.map((option) => {
            const selected = selectedStatus === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedStatus(option)}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  selected
                    ? 'border-accent bg-accent text-white'
                    : 'border-surface-alt bg-surface-alt text-text-secondary hover:bg-surface',
                ].join(' ')}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="mb-5">
          <label htmlFor="decision-anchor-summary" className="mb-2 block text-sm font-medium text-text-primary">
            Summary
          </label>
          <textarea
            id="decision-anchor-summary"
            value={editedSummary}
            onChange={(event) => setEditedSummary(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-surface-alt bg-surface-alt px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Summarize the current state"
          />
        </div>

        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-text-primary">Files in play</p>
          {filesInPlay.length > 0 ? (
            <ul className="space-y-2 text-sm text-text-secondary">
              {filesInPlay.map((filePath) => (
                <li key={filePath} className="rounded-md bg-surface-alt px-3 py-2 font-mono text-xs">
                  {filePath}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">No files were detected for this transition.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-text-secondary underline underline-offset-4 transition hover:text-text-primary"
              >
                Skip
              </button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                status: selectedStatus,
                summary: editedSummary,
              })
            }
            className={[
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              canConfirm
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'cursor-not-allowed bg-surface-alt text-text-secondary',
            ].join(' ')}
          >
            Confirm Anchor
          </button>
        </div>
      </div>
    </div>
  );
}
