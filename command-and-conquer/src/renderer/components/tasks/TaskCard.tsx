import React from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface TaskCardProps {
  id: string;
  title: string;
  status: string;
  size: 'Micro' | 'Standard' | 'Major';
  priority: number;
  onClick: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  title,
  status,
  size,
  priority,
  onClick
}) => {
  const getSizeBadgeClass = () => {
    switch (size) {
      case 'Micro': return 'bg-blue-500/20 text-blue-400';
      case 'Standard': return 'bg-purple-500/20 text-purple-400';
      case 'Major': return 'bg-red-500/20 text-red-400';
      default: return 'bg-surface-alt text-text-secondary';
    }
  };

  const getStatusBadgeClass = () => {
    const s = status.toLowerCase();
    if (s === 'backlog') return 'bg-gray-500/20 text-gray-400';
    if (s === 'active' || s === 'in_progress') return 'bg-blue-500/20 text-blue-400';
    if (s === 'review') return 'bg-yellow-500/20 text-yellow-400';
    if (s === 'done' || s === 'completed') return 'bg-badge-green/20 text-badge-green';
    return 'bg-surface-alt text-text-secondary';
  };

  return (
    <div
      onClick={onClick}
      className="bg-surface-alt rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-accent transition-all flex flex-col gap-3 group"
      {...tooltipProps(`Open task: ${title}`)}
    >
      <div className="flex justify-between items-center">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getSizeBadgeClass()}`}>
          {size}
        </span>
        <span className="text-xs text-text-secondary font-mono">
          P{priority}
        </span>
      </div>

      <h3 className="text-text-primary font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-accent transition-colors">
        {title}
      </h3>

      <div className="flex items-center">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass()}`}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};

export default TaskCard;
