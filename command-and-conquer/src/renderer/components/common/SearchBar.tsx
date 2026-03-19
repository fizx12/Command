import React from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;                 // defaults to "Search..."
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...'
}) => {
  return (
    <div className="w-full bg-surface-alt rounded-lg flex items-center px-3 py-2 border border-transparent focus-within:border-accent/50 transition-colors">
      <svg
        className="w-4 h-4 text-text-secondary mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-text-primary placeholder:text-text-secondary w-full text-sm"
      />
    </div>
  );
};

export default SearchBar;
