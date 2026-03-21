import React from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface ConflictPanelProps {
  conflict: {
    id: string;
    docIdA: string;
    docIdB: string;
    description: string;
    recommendation: string;
    resolution: string | null;
  };
  onResolve: (resolution: 'acceptA' | 'acceptB' | 'manualMerge') => void;
}

const ConflictPanel: React.FC<ConflictPanelProps> = ({ conflict, onResolve }) => {
  return (
    <div className="bg-surface rounded-lg border border-surface-alt overflow-hidden">
      <div className="bg-surface-alt/50 px-4 py-3 border-b border-surface-alt flex justify-between items-center">
        <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase">
          Conflict: {conflict.id}
        </h3>
        {conflict.resolution && (
          <span className="bg-badge-green/20 text-badge-green text-[10px] font-bold px-2 py-0.5 rounded">
            RESOLVED: {conflict.resolution}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-surface-alt/20 border-l-4 border-accent rounded-r">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Document A</span>
            <div className="text-sm text-text-primary mt-1 font-mono truncate">{conflict.docIdA}</div>
          </div>
          <div className="p-3 bg-surface-alt/20 border-l-4 border-accent rounded-r">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Document B</span>
            <div className="text-sm text-text-primary mt-1 font-mono truncate">{conflict.docIdB}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text-secondary uppercase">AI Summary</span>
          <div className="bg-surface-alt p-3 rounded text-sm text-text-primary leading-relaxed">
            {conflict.description}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-text-secondary uppercase">Recommendation</span>
          <p className="text-sm text-text-primary italic">
            {conflict.recommendation}
          </p>
        </div>

        {!conflict.resolution && (
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onResolve('acceptA')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              {...tooltipProps(`Accept version A for conflict ${conflict.id}`)}
            >
              Accept A
            </button>
            <button
              onClick={() => onResolve('acceptB')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              {...tooltipProps(`Accept version B for conflict ${conflict.id}`)}
            >
              Accept B
            </button>
            <button
              onClick={() => onResolve('manualMerge')}
              className="px-4 py-2 bg-surface-alt border border-text-secondary/30 text-text-primary rounded-lg text-sm font-medium hover:bg-surface transition-colors"
              {...tooltipProps(`Open manual merge for conflict ${conflict.id}`)}
            >
              Manual Merge
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictPanel;
