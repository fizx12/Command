import React from 'react';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflictId: string;
  docATitle: string;
  docBTitle: string;
  description: string;
  recommendation: string;
  onResolve: (resolution: 'acceptA' | 'acceptB' | 'manualMerge') => void;
  onClose: () => void;
}

export default function ConflictResolutionModal({
  isOpen,
  conflictId,
  docATitle,
  docBTitle,
  description,
  recommendation,
  onResolve,
  onClose,
}: ConflictResolutionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-resolution-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-surface p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Conflict {conflictId}
            </p>
            <h2 id="conflict-resolution-title" className="text-xl font-semibold text-text-primary">
              Resolve Conflict
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-alt hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-surface-alt p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">AI Summary</p>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>

        <p className="mb-6 text-sm italic text-text-secondary">{recommendation}</p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onResolve('acceptA')}
            className="w-full rounded-lg bg-accent px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Accept: {docATitle}
          </button>

          <button
            type="button"
            onClick={() => onResolve('acceptB')}
            className="w-full rounded-lg bg-accent px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Accept: {docBTitle}
          </button>

          <button
            type="button"
            onClick={() => onResolve('manualMerge')}
            className="w-full rounded-lg border border-surface-alt bg-surface-alt px-4 py-3 text-left text-sm font-semibold text-text-primary transition hover:bg-surface"
          >
            Manual Merge
          </button>
        </div>
      </div>
    </div>
  );
}
