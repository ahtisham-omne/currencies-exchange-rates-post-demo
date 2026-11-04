import { useState } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw, Calendar, X, AlertCircle, GitBranch } from 'lucide-react';

interface ReviveCancelledModalProps {
  quoteNumber: string;
  customerName: string;
  currentVersion: number;
  /** The status the quote was in before it was cancelled */
  statusBeforeCancellation: 'draft' | 'sent' | 'confirmed' | 'converted' | 'expired' | null;
  cancellationReason?: string | null;
  onConfirm: (newExpiryDate: string) => void;
  onClose: () => void;
}

export function ReviveCancelledModal({
  quoteNumber,
  customerName,
  currentVersion,
  statusBeforeCancellation,
  cancellationReason,
  onConfirm,
  onClose,
}: ReviveCancelledModalProps) {
  const today = new Date('2026-02-23');
  const defaultExpiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const toInputDate = (d: Date) => d.toISOString().split('T')[0];
  const [newExpiryDate, setNewExpiryDate] = useState(toInputDate(defaultExpiry));

  const isValid = newExpiryDate && new Date(newExpiryDate) > today;

  // Determine whether version will be bumped
  const willBumpVersion = statusBeforeCancellation !== 'draft';
  const newVersion = willBumpVersion ? currentVersion + 1 : currentVersion;

  const statusLabel = statusBeforeCancellation
    ? statusBeforeCancellation.charAt(0).toUpperCase() + statusBeforeCancellation.slice(1)
    : 'Unknown';

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px', width: '480px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: '#1B6EF3' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
              Reactivate Cancelled Quote
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px', lineHeight: '1' }}>
              Reopen this quote as a draft for editing
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '6px', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9CA3AF', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#6B7280'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {/* Context info */}
          <div style={{
            display: 'flex', gap: '10px', padding: '10px 12px',
            backgroundColor: '#F9FAFB', borderRadius: '8px',
            border: '1px solid #E5E7EB', marginBottom: '16px',
          }}>
            <AlertCircle style={{ width: '14px', height: '14px', color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
              <strong>{quoteNumber}</strong> for <strong>{customerName}</strong> was cancelled
              {statusBeforeCancellation && (
                <> while in <strong>{statusLabel}</strong> status</>
              )}
              .{cancellationReason && (
                <> Reason: <span style={{ color: '#6B7280' }}>{cancellationReason}</span></>
              )}
            </div>
          </div>

          {/* Version info strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
            backgroundColor: willBumpVersion ? '#EFF6FF' : '#F9FAFB',
            borderRadius: '8px',
            border: `1px solid ${willBumpVersion ? '#BFDBFE' : '#E5E7EB'}`,
            marginBottom: '20px',
          }}>
            <GitBranch style={{ width: '14px', height: '14px', color: willBumpVersion ? '#1B6EF3' : '#6B7280', flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
              {willBumpVersion ? (
                <>
                  A new <strong>Version {newVersion}</strong> will be created as <strong>Draft</strong>, branching from V{currentVersion} ({statusLabel}).
                </>
              ) : (
                <>
                  <strong>Version {currentVersion}</strong> will be reopened as <strong>Draft</strong>. No new version will be created since it was already a draft when cancelled.
                </>
              )}
            </div>
          </div>

          {/* New Expiry Date */}
          <div>
            <label style={{
              fontSize: '11px', fontWeight: 600, color: '#374151',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              display: 'block', marginBottom: '6px', lineHeight: '1',
            }}>
              New Expiry Date <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={newExpiryDate}
                min={toInputDate(new Date(today.getTime() + 86400000))}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                style={{
                  width: '100%', height: '36px', paddingLeft: '32px', paddingRight: '12px',
                  fontSize: '13px', color: '#1F2937', border: '1px solid #E5E7EB',
                  borderRadius: '6px', outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                  transition: 'border-color 150ms',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1' }}>
              The reactivated quote will be valid until this date
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: '1px solid #E5E7EB',
        }}>
          <button
            onClick={onClose}
            style={{
              height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: '1', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Cancel
          </button>
          <button
            disabled={!isValid}
            onClick={() => isValid && onConfirm(newExpiryDate)}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: isValid ? '#1B6EF3' : '#D1D5DB',
              border: 'none', borderRadius: '6px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { if (isValid) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
            onMouseLeave={e => { if (isValid) e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            {willBumpVersion ? `Reactivate as V${newVersion} Draft` : `Reopen V${currentVersion} Draft`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}