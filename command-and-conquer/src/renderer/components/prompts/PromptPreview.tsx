import React from 'react';

interface PromptPreviewProps {
  compiledText: string;
  tokenEstimate: number;
  onCopy: () => void;
  onExport: () => void;
  badgeLabel?: string;
  badgeTone?: 'default' | 'tightened' | 'applied';
  banner?: string;
}

const PromptPreview: React.FC<PromptPreviewProps> = ({
  compiledText,
  tokenEstimate,
  onCopy,
  onExport,
  badgeLabel,
  badgeTone = 'default',
  banner
}) => {
  const badgeClass =
    badgeTone === 'applied'
      ? 'bg-badge-green/15 text-badge-green border border-badge-green/30'
      : badgeTone === 'tightened'
        ? 'bg-purple-600/15 text-purple-400 border border-purple-600/30'
        : 'bg-badge-green/10 text-badge-green border border-badge-green/20';

  return (
    <div className={`flex flex-col bg-surface border rounded-lg overflow-hidden h-full max-h-[750px] shadow-lg ${
      badgeTone === 'applied'
        ? 'border-badge-green/30'
        : badgeTone === 'tightened'
          ? 'border-purple-600/30'
          : 'border-surface-alt'
    }`}>
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-surface-alt/50 border-b border-surface-alt gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase">
            Compiled Prompt
          </h3>
          {badgeLabel && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${badgeClass}`}>
              {badgeLabel}
            </span>
          )}
          <span className="bg-badge-green/10 text-badge-green text-[10px] font-bold px-2 py-0.5 rounded border border-badge-green/20">
            {tokenEstimate} est. tokens
          </span>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012-2" />
            </svg>
            Copy
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-alt text-text-primary border border-text-secondary/30 rounded text-xs font-semibold hover:bg-surface transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 bg-surface overflow-y-auto">
        {banner && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-[11px] font-medium ${
            badgeTone === 'applied'
              ? 'bg-badge-green/10 text-badge-green border border-badge-green/20'
              : badgeTone === 'tightened'
                ? 'bg-purple-600/10 text-purple-300 border border-purple-600/20'
                : 'bg-surface-alt text-text-secondary border border-surface-alt'
          }`}>
            {banner}
          </div>
        )}
        <pre className="whitespace-pre-wrap font-mono text-sm text-text-primary leading-relaxed selection:bg-accent/30">
          {compiledText || <span className="text-text-secondary italic">No prompt generated yet...</span>}
        </pre>
      </div>
    </div>
  );
};

export default PromptPreview;
