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
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--card)', borderRadius: '12px', width: '480px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: 'rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: 'var(--warning)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>
              Reactivate Expired Quote
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px', lineHeight: '1' }}>
              Set new dates to reactivate this quote
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '6px', border: 'none',
              backgroundColor: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted-foreground)', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {/* Context info */}
          <div style={{
            display: 'flex', gap: '10px', padding: '10px 12px',
            backgroundColor: 'rgba(217, 119, 6, 0.1)', borderRadius: '8px',
            border: '1px solid rgba(217, 119, 6, 0.3)', marginBottom: '20px',
          }}>
            <Clock style={{ width: '14px', height: '14px', color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: '1.5' }}>
              <strong>{quoteNumber}</strong> for <strong>{customerName}</strong> expired{' '}
              {daysSinceExpiry > 0 ? `${daysSinceExpiry} day${daysSinceExpiry !== 1 ? 's' : ''} ago` : 'today'} on{' '}
              {formatDisplayDate(originalExpiryDate)}. Reactivating will move the quote back to "Sent to Customer" with updated dates.
            </div>
          </div>

          {/* New Expiry Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '11px', fontWeight: 500, color: 'var(--foreground-soft)',
              textTransform: 'none',
              display: 'block', marginBottom: '6px', lineHeight: '1',
            }}>
              New Expiration Date <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '14px', height: '14px', color: 'var(--muted-foreground)', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={newExpiryDate}
                min={toInputDate(new Date(today.getTime() + 86400000))}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                style={{
                  width: '100%', height: '36px', paddingLeft: '32px', paddingRight: '12px',
                  fontSize: '13px', color: 'var(--foreground)', border: '1px solid var(--border)',
                  borderRadius: '6px', outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                  transition: 'border-color 150ms',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px', lineHeight: '1' }}>
              Quote will remain valid until this date
            </div>
          </div>

          {/* Respond-By Date (optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', fontWeight: 500, color: 'var(--foreground)',
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
                  width: '14px', height: '14px', color: 'var(--muted-foreground)', pointerEvents: 'none',
                }} />
                <input
                  type="date"
                  value={respondByDate}
                  min={toInputDate(new Date(today.getTime() + 86400000))}
                  max={newExpiryDate}
                  onChange={(e) => setRespondByDate(e.target.value)}
                  style={{
                    width: '100%', height: '36px', paddingLeft: '32px', paddingRight: '12px',
                    fontSize: '13px', color: 'var(--foreground)', border: '1px solid var(--border)',
                    borderRadius: '6px', outline: 'none',
                    fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                    transition: 'border-color 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px', lineHeight: '1' }}>
                  Customer should respond by this date (must be before expiry)
                </div>
              </div>
            )}
          </div>

          {/* Resend option */}
          <div style={{
            padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
            backgroundColor: 'var(--muted)',
          }}>
            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                fontSize: '12px', color: 'var(--foreground)', cursor: 'pointer',
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
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
                  Automatically email the updated quote with new dates to the customer's point of contact
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
              backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
              borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: '1', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--background)'; }}
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
              height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: canSubmit ? 'var(--warning)' : 'var(--border)',
              border: 'none', borderRadius: '6px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.backgroundColor = 'var(--warning)'; }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.backgroundColor = 'var(--warning)'; }}
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