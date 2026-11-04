import React from 'react';
import { AlertCircle, CornerUpLeft } from 'lucide-react';

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
    iconBg: '#1B6EF3',
    buttonBg: '#1B6EF3',
    buttonHover: '#0D5ED7'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white shadow-2xl"
        style={{
          borderRadius: '12px',
          width: '440px',
          padding: '24px'
        }}
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
        <h3 
          className="text-[#1F2937] mb-2"
          style={{ 
            fontSize: '18px',
            fontWeight: 600,
            lineHeight: '1.3'
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <p 
          className="text-[#6B7280] mb-6"
          style={{
            fontSize: '14px',
            lineHeight: '1.5'
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all flex items-center justify-center gap-2"
            style={{
              height: '40px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              paddingLeft: '16px',
              paddingRight: '16px'
            }}
          >
            <span>{cancelText}</span>
            <span className="text-[11px] text-[#6B7280] font-normal px-1.5 py-0.5 bg-[#F3F4F6] rounded" style={{ fontSize: '11px' }}>
              esc
            </span>
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
            style={{
              height: '40px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: colors.buttonBg,
              paddingLeft: '16px',
              paddingRight: '16px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonBg}
          >
            <span>{confirmText}</span>
            <span className="flex items-center justify-center bg-white/20 rounded" style={{ width: '20px', height: '20px' }}>
              <CornerUpLeft className="w-3 h-3" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}