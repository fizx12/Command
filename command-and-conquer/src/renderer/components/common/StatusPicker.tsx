import React from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface StatusPickerProps {
  options: string[];                    // list of status labels
  value: string;                        // currently selected
  onChange: (value: string) => void;
  label?: string;                       // optional label above picker
}

const StatusPicker: React.FC<StatusPickerProps> = ({ options, value, onChange, label }) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-text-secondary text-sm">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              value === option
                ? 'bg-accent text-white'
                : 'bg-surface-alt text-text-secondary hover:bg-surface'
            }`}
            {...tooltipProps(`Set status to ${option}`)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StatusPicker;
