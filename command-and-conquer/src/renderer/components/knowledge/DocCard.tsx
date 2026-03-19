import React from 'react';

interface DocCardProps {
  id: string;
  title: string;
  category: string;
  trustLevel: string;
  staleFlag: boolean;
  conflictFlag: boolean;
  lastUpdatedAt: string;
  onClick: () => void;
}

const DocCard: React.FC<DocCardProps> = ({
  title,
  category,
  trustLevel,
  staleFlag,
  conflictFlag,
  lastUpdatedAt,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-surface-alt rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-accent transition-all flex flex-col gap-3 group"
    >
      <div className="flex justify-between items-start">
        <h3 className="text-text-primary font-medium text-sm leading-tight group-hover:text-accent transition-colors">
          {title}
        </h3>
        <div className="flex gap-1">
          {staleFlag && (
            <span className="bg-badge-yellow/20 text-badge-yellow text-[10px] font-bold px-1.5 py-0.5 rounded">
              STALE
            </span>
          )}
          {conflictFlag && (
            <span className="bg-badge-red/20 text-badge-red text-[10px] font-bold px-1.5 py-0.5 rounded">
              CONFLICT
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <span className="bg-surface px-2 py-0.5 rounded text-[10px] font-bold text-text-secondary uppercase">
          {category}
        </span>
        <span className="bg-accent/10 px-2 py-0.5 rounded text-[10px] font-bold text-accent uppercase">
          {trustLevel}
        </span>
      </div>

      <div className="mt-auto pt-2 border-t border-surface/30">
        <span className="text-[10px] text-text-secondary">
          Updated: {lastUpdatedAt}
        </span>
      </div>
    </div>
  );
};

export default DocCard;
