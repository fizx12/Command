import React, { useState, useEffect } from 'react';

interface ConfirmButtonProps {
  label: string;                        // e.g. "Delete"
  confirmLabel?: string;                // e.g. "Are you sure?" — defaults to "Confirm?"
  onConfirm: () => void;
  variant?: 'danger' | 'primary';       // default 'primary'
  disabled?: boolean;
}

const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  label,
  confirmLabel = 'Confirm?',
  onConfirm,
  variant = 'primary',
  disabled = false
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isConfirming) {
      timer = setTimeout(() => {
        setIsConfirming(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isConfirming]);

  const handleClick = () => {
    if (isConfirming) {
      onConfirm();
      setIsConfirming(false);
    } else {
      setIsConfirming(true);
    }
  };

  const getVariantClasses = () => {
    if (disabled) return 'bg-surface-alt text-text-secondary cursor-not-allowed opacity-50';
    if (isConfirming) return 'bg-badge-yellow text-white';
    if (variant === 'danger') return 'bg-badge-red text-white hover:opacity-90';
    return 'bg-accent text-white hover:opacity-90';
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${getVariantClasses()}`}
    >
      {isConfirming ? confirmLabel : label}
    </button>
  );
};

export default ConfirmButton;
