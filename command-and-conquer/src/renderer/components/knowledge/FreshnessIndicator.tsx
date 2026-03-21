import React, { useState } from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface FreshnessIndicatorProps {
  staleFlag: boolean;
  lastReviewedAt: string;
  watchFiles: string[];
}

const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  staleFlag,
  lastReviewedAt,
  watchFiles
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {staleFlag ? (
        <div className="bg-badge-yellow/10 border border-badge-yellow/30 rounded-lg p-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-badge-yellow shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-badge-yellow">This document may be stale</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-badge-green">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Up to date</span>
        </div>
      )}

      <div className="flex flex-col gap-1 px-1">
        <span className="text-xs text-text-secondary">
          Last reviewed: <span className="text-text-primary font-medium">{lastReviewedAt}</span>
        </span>
        
        <div className="mt-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-accent hover:underline"
            {...tooltipProps(isExpanded ? 'Hide watched file patterns' : 'Show watched file patterns')}
          >
            <span>Watching: {watchFiles.length} file patterns</span>
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isExpanded && watchFiles.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 pl-3 border-l border-surface-alt">
              {watchFiles.map((pattern, idx) => (
                <li key={idx} className="text-[10px] font-mono text-text-secondary truncate">
                  {pattern}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreshnessIndicator;
