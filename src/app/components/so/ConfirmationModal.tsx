import React from 'react';
import { AlertCircle, CornerUpLeft, Copy } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'blue' | 'yellow' | 'red';
  icon?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  onConfirm,
  onCancel,
  variant = 'blue',
  icon
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colors = variant === 'yellow' ? {
    iconBg: '#F59E0B',
    buttonBg: '#F59E0B',
    buttonHover: '#D97706'
  } : variant === 'red' ? {
    iconBg: '#EF4444',
    buttonBg: '#EF4444',
    buttonHover: '#DC2626'
  } : {
    iconBg: 'var(--primary)',
    buttonBg: 'var(--primary)',
    buttonHover: '#0D5ED7'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    else if (e.key === 'Enter') onConfirm();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-card"
        style={{ borderRadius: 'var(--radius-xl)', width: '440px', padding: '24px', boxShadow: 'var(--elevation-3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: colors.iconBg }}
        >
          {icon || <AlertCircle className="w-6 h-6 text-white" />}
        </div>

        {/* Title */}
        <h3 className="text-foreground mb-2" style={{ fontSize: '18px', fontWeight: 600, lineHeight: '1.3' }}>
          {title}
        </h3>

        {/* Message */}
        <p className="text-foreground/50 mb-6" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>

        {/* Buttons — confirm is full-width colored, cancel is borderless below */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
            style={{
              height: '44px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              backgroundColor: colors.buttonBg, border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonBg}
          >
            {confirmText}
          </button>

          <button
            onClick={onCancel}
            className="w-full text-foreground/60 hover:text-foreground hover:bg-secondary transition-all flex items-center justify-center gap-2"
            style={{
              height: '44px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
              backgroundColor: 'transparent', border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
