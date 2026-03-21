import React from 'react';
import { tooltipProps } from '../../utils/tooltips';

interface SizeSelectorProps {
  value: 'Micro' | 'Standard' | 'Major';
  onChange: (size: 'Micro' | 'Standard' | 'Major') => void;
}

const SizeSelector: React.FC<SizeSelectorProps> = ({ value, onChange }) => {
  const options = [
    {
      id: 'Micro' as const,
      label: 'Micro',
      description: 'Quick fix, single file, <30min',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'Standard' as const,
      label: 'Standard',
      description: 'Multi-file, 30min-half day',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      )
    },
    {
      id: 'Major' as const,
      label: 'Major',
      description: 'Architecture change, >half day',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`flex-1 flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
            value === option.id
              ? 'border-accent bg-accent/10 ring-1 ring-accent/20'
              : 'border-surface-alt bg-surface-alt/50 hover:bg-surface hover:border-text-secondary/30'
          }`}
          {...tooltipProps(`${option.label} - ${option.description}`)}
        >
          <div className={`${value === option.id ? 'text-accent' : 'text-text-secondary'}`}>
            {option.icon}
          </div>
          <div>
            <div className={`font-bold ${value === option.id ? 'text-accent' : 'text-text-primary'}`}>
              {option.label}
            </div>
            <div className="text-xs text-text-secondary mt-1 leading-relaxed">
              {option.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SizeSelector;
