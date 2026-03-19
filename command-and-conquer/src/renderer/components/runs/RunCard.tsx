import React from 'react';

interface RunCardProps {
  id: string;
  tool: string;
  model: string;
  status: string;
  summary: string;
  changedFileCount: number;
  createdAt: string;
  taskTitle?: string;
  onClick: () => void;
}

const RunCard: React.FC<RunCardProps> = ({
  id,
  tool,
  model,
  status,
  summary,
  changedFileCount,
  createdAt,
  taskTitle,
  onClick
}) => {
  const getStatusColor = () => {
    const s = status.toLowerCase();
    if (s === 'success' || s === 'completed') return 'bg-badge-green';
    if (s === 'failed' || s === 'error') return 'bg-badge-red';
    if (s === 'running' || s === 'in_progress') return 'bg-accent animate-pulse';
    return 'bg-badge-yellow';
  };

  return (
    <div
      onClick={onClick}
      className="bg-surface-alt rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-accent transition-all flex flex-col gap-3 group"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor()}`} />
            <span className="text-sm font-mono text-text-secondary group-hover:text-accent transition-colors">
              {id}
            </span>
          </div>
          {taskTitle && (
            <span className="text-xs font-medium text-text-primary pl-4 truncate max-w-[22rem]">{taskTitle}</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <span className="bg-surface px-1.5 py-0.5 rounded text-[10px] font-bold text-text-secondary uppercase">
            {tool}
          </span>
          <span className="bg-accent/10 px-1.5 py-0.5 rounded text-[10px] font-bold text-accent uppercase">
            {model}
          </span>
        </div>
      </div>

      <p className="text-text-primary text-sm leading-snug line-clamp-3 min-h-[3rem]">
        {summary || 'No summary provided for this run.'}
      </p>

      <div className="flex justify-between items-center mt-auto pt-2 border-t border-surface/30">
        <span className="text-[10px] text-text-secondary font-medium">
          {changedFileCount} files changed
        </span>
        <span className="text-[10px] text-text-secondary font-mono">
          {createdAt}
        </span>
      </div>
    </div>
  );
};

export default RunCard;
