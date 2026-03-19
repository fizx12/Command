import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;            // optional buttons to render on the right
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="flex justify-between items-center py-4 px-6 bg-surface border-b border-surface-alt">
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-text-primary leading-tight">
          {title}
        </h1>
        {subtitle && (
          <span className="text-sm text-text-secondary mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
};

export default Header;
