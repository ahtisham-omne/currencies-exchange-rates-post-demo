import { useState } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw, Calendar, X, Clock, Send } from 'lucide-react';

interface ReviveQuoteModalProps {
  quoteNumber: string;
  customerName: string;
  originalExpiryDate: Date;
  onConfirm: (newExpiryDate: string, newRespondBy: string | null, resendToCustomer: boolean) => void;
  onClose: () => void;
}

export function ReviveQuoteModal({
  quoteNumber,
  customerName,
  originalExpiryDate,
  onConfirm,
  onClose,
}: ReviveQuoteModalProps) {
  // Default new expiry: 30 days from today
  const today = new Date('2026-02-20');
  const defaultExpiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const defaultRespondBy = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const toInputDate = (d: Date) => d.toISOString().split('T')[0];

  const [newExpiryDate, setNewExpiryDate] = useState(toInputDate(defaultExpiry));
  const [includeRespondBy, setIncludeRespondBy] = useState(true);
  const [respondByDate, setRespondByDate] = useState(toInputDate(defaultRespondBy));
  const [resendToCustomer, setResendToCustomer] = useState(true);

  const isValid = newExpiryDate && new Date(newExpiryDate) > today;
  const respondByValid = !includeRespondBy || (respondByDate && new Date(respondByDate) > today && new Date(respondByDate) <= new Date(newExpiryDate));

  const canSubmit = isValid && respondByValid;

  const formatDisplayDate = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day}/${d.getFullYear()}`;
  };

  const daysSinceExpiry = Math.floor((today.getTime() - originalExpiryDate.getTime()) / (1000 * 60 * 60 * 24));

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
            backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: '#D97706' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
              Reactivate Expired Quote
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px', lineHeight: '1' }}>
              Set new dates to reactivate this quote
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
            backgroundColor: '#FFFBEB', borderRadius: '8px',
            border: '1px solid #FDE68A', marginBottom: '20px',
          }}>
            <Clock style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
              <strong>{quoteNumber}</strong> for <strong>{customerName}</strong> expired{' '}
              {daysSinceExpiry > 0 ? `${daysSinceExpiry} day${daysSinceExpiry !== 1 ? 's' : ''} ago` : 'today'} on{' '}
              {formatDisplayDate(originalExpiryDate)}. Reactivating will move the quote back to "Sent to Customer" with updated dates.
            </div>
          </div>

          {/* New Expiry Date */}
          <div style={{ marginBottom: '16px' }}>
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
              Quote will remain valid until this date
            </div>
          </div>

          {/* Respond-By Date (optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', fontWeight: 500, color: '#374151',
                cursor: 'pointer', marginBottom: '8px',
              }}
            >
              <input
                type="checkbox"
                checked={includeRespondBy}
                onChange={(e) => setIncludeRespondBy(e.target.checked)}
                style={{ width: '14px', height: '14px', borderRadius: '3px', cursor: 'pointer' }}
              />
              Set a Respond-By deadline
            </label>
            {includeRespondBy && (
              <div style={{ position: 'relative' }}>
                <Calendar style={{
                  position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                  width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none',
                }} />
                <input
                  type="date"
                  value={respondByDate}
                  min={toInputDate(new Date(today.getTime() + 86400000))}
                  max={newExpiryDate}
                  onChange={(e) => setRespondByDate(e.target.value)}
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
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1' }}>
                  Customer should respond by this date (must be before expiry)
                </div>
              </div>
            )}
          </div>

          {/* Resend option */}
          <div style={{
            padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
          }}>
            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                fontSize: '12px', color: '#374151', cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={resendToCustomer}
                onChange={(e) => setResendToCustomer(e.target.checked)}
                style={{ width: '14px', height: '14px', borderRadius: '3px', cursor: 'pointer', marginTop: '1px', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 500, lineHeight: '1', marginBottom: '4px' }}>
                  Resend to customer
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.4' }}>
                  Automatically email the updated quote with new dates to the customer's point of contact
                </div>
              </div>
            </label>
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
            disabled={!canSubmit}
            onClick={() => canSubmit && onConfirm(
              newExpiryDate,
              includeRespondBy ? respondByDate : null,
              resendToCustomer,
            )}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: canSubmit ? '#D97706' : '#D1D5DB',
              border: 'none', borderRadius: '6px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#B45309'; }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.backgroundColor = '#D97706'; }}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            Reactivate Quote
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}