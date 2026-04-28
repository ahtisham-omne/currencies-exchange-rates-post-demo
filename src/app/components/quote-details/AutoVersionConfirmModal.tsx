import React from 'react';
import { GitBranch, AlertTriangle, Undo2, X } from 'lucide-react';

interface AutoVersionConfirmModalProps {
  isOpen: boolean;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
  currentVersion: number;
  fromStatus: string; // 'Sent' or 'Confirmed'
  onConfirm: () => void;
  onDiscard: () => void;
}

export function AutoVersionConfirmModal({
  isOpen,
  fieldLabel,
  oldValue,
  newValue,
  currentVersion,
  fromStatus,
  onConfirm,
  onDiscard,
}: AutoVersionConfirmModalProps) {
  if (!isOpen) return null;

  const newVersion = currentVersion + 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(1px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onDiscard}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: '90vw',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: '#FEF3C7', border: '1px solid #FDE68A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle style={{ width: '15px', height: '15px', color: '#D97706' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
                Create New Version?
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                Material change detected
              </div>
            </div>
          </div>
          <button
            onClick={onDiscard}
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
              color: '#9CA3AF', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Body — change box + concise description */}
        <div style={{ padding: '16px 20px' }}>
          {/* Change summary box */}
          <div style={{
            padding: '10px 12px', borderRadius: '6px',
            backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
              Change
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }}>
              {fieldLabel}
            </div>
            {(oldValue || newValue) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                {oldValue && (
                  <span style={{
                    fontSize: '12px', color: '#991B1B', fontWeight: 500,
                    padding: '2px 6px', borderRadius: '3px',
                    backgroundColor: '#FEE2E2',
                    textDecoration: 'line-through',
                    maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {oldValue}
                  </span>
                )}
                {oldValue && newValue && (
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>→</span>
                )}
                {newValue && (
                  <span style={{
                    fontSize: '12px', color: '#065F46', fontWeight: 500,
                    padding: '2px 6px', borderRadius: '3px',
                    backgroundColor: '#D1FAE5',
                    maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {newValue}
                  </span>
                )}
              </div>
            )}
          </div>

          <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
            The quote is currently in <strong style={{ fontWeight: 600, color: '#1F2937' }}>{fromStatus}</strong> status.
            This change requires creating a new draft version (V{newVersion}).
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5, margin: '6px 0 0 0' }}>
            You can discard instead if this was unintentional.
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: '1px solid #F3F4F6',
        }}>
          <button
            onClick={onDiscard}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 14px', borderRadius: '6px',
              border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
              color: '#6B7280', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 120ms',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <Undo2 style={{ width: '13px', height: '13px' }} />
            Discard Change
          </button>
          <button
            onClick={onConfirm}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 16px', borderRadius: '6px',
              border: 'none', backgroundColor: '#1B6EF3',
              color: '#FFFFFF', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 120ms',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
          >
            <GitBranch style={{ width: '13px', height: '13px' }} />
            Create V{newVersion} Draft
          </button>
        </div>
      </div>
    </div>
  );
}