import React from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface HealthBadgeProps {
  status: 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md';                   // default 'md'
  showLabel?: boolean;                   // default false
}

const HealthBadge: React.FC<HealthBadgeProps> = ({ 
  status, 
  size = 'md', 
  showLabel = false 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'green': return 'bg-badge-green';
      case 'yellow': return 'bg-badge-yellow';
      case 'red': return 'bg-badge-red';
      default: return 'bg-text-secondary';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'green': return 'Healthy';
      case 'yellow': return 'Warning';
      case 'red': return 'Critical';
      default: return 'Unknown';
    }
  };

  const circleSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className="inline-flex items-center gap-2">
      <div 
        className={`${circleSize} rounded-full ${getStatusColor()}`}
        {...(!showLabel ? tooltipProps(getStatusLabel()) : {})}
      />
      {showLabel && (
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium text-text-primary`}>
          {getStatusLabel()}
        </span>
      )}
    </div>
  );
};

export default HealthBadge;
