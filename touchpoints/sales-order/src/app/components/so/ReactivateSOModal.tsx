import { useState } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw, Calendar, X, AlertCircle, GitBranch } from 'lucide-react';

interface ReactivateSOModalProps {
  soNumber: string;
  customerName: string;
  currentVersion: number;
  /** The status the SO was in before it was cancelled/archived/expired */
  previousStatus: 'Draft' | 'Pending Review' | 'Cleared' | 'Partially Shipped' | 'Shipped' | 'Cancelled' | 'Archived' | 'Expired' | null;
  reason?: string | null;
  variant: 'cancelled' | 'archived' | 'expired';
  onConfirm: (newDeliveryDate: string) => void;
  onClose: () => void;
}

const VARIANT_CONFIG = {
  cancelled: {
    title: 'Reactivate Cancelled Order',
    subtitle: 'Reopen this sales order as a draft for editing',
    iconBg: '#EFF6FF',
    iconColor: '#1B6EF3',
    alertBg: '#F9FAFB',
    alertBorder: '#E5E7EB',
    alertIconColor: '#DC2626',
    alertVerb: 'cancelled',
    buttonBg: '#1B6EF3',
    buttonHover: '#0D5ED7',
    dateLabel: 'New Requested Delivery Date',
    dateHint: 'The reactivated order will target this delivery date',
  },
  archived: {
    title: 'Reactivate Archived Order',
    subtitle: 'Restore this sales order as a draft for editing',
    iconBg: '#F1F5F9',
    iconColor: '#475569',
    alertBg: '#F9FAFB',
    alertBorder: '#E5E7EB',
    alertIconColor: '#6B7280',
    alertVerb: 'archived',
    buttonBg: '#475569',
    buttonHover: '#334155',
    dateLabel: 'New Requested Delivery Date',
    dateHint: 'The reactivated order will target this delivery date',
  },
  expired: {
    title: 'Reactivate Expired Order',
    subtitle: 'Set new dates to reactivate this order',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    alertBg: '#FFFBEB',
    alertBorder: '#FDE68A',
    alertIconColor: '#D97706',
    alertVerb: 'expired',
    buttonBg: '#D97706',
    buttonHover: '#B45309',
    dateLabel: 'New Requested Delivery Date',
    dateHint: 'The reactivated order will target this delivery date',
  },
};

export function ReactivateSOModal({
  soNumber,
  customerName,
  currentVersion,
  previousStatus,
  reason,
  variant,
  onConfirm,
  onClose,
}: ReactivateSOModalProps) {
  const today = new Date('2026-03-30');
  const defaultDelivery = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const toInputDate = (d: Date) => d.toISOString().split('T')[0];
  const [newDeliveryDate, setNewDeliveryDate] = useState(toInputDate(defaultDelivery));

  const isValid = newDeliveryDate && new Date(newDeliveryDate) > today;

  const willBumpVersion = previousStatus !== 'Draft';
  const newVersion = willBumpVersion ? currentVersion + 1 : currentVersion;

  const statusLabel = previousStatus || 'Unknown';
  const cfg = VARIANT_CONFIG[variant];

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
            backgroundColor: cfg.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: cfg.iconColor }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
              {cfg.title}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px', lineHeight: '1' }}>
              {cfg.subtitle}
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
            backgroundColor: cfg.alertBg, borderRadius: '8px',
            border: `1px solid ${cfg.alertBorder}`, marginBottom: '16px',
          }}>
            <AlertCircle style={{ width: '14px', height: '14px', color: cfg.alertIconColor, flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
              <strong>{soNumber}</strong> for <strong>{customerName}</strong> was {cfg.alertVerb}
              {previousStatus && (
                <> while in <strong>{statusLabel}</strong> status</>
              )}
              .{reason && (
                <> Reason: <span style={{ color: '#6B7280' }}>{reason}</span></>
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
                  <strong>Version {currentVersion}</strong> will be reopened as <strong>Draft</strong>. No new version will be created since it was already a draft when {cfg.alertVerb}.
                </>
              )}
            </div>
          </div>

          {/* New Delivery Date */}
          <div>
            <label style={{
              fontSize: '11px', fontWeight: 600, color: '#374151',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              display: 'block', marginBottom: '6px', lineHeight: '1',
            }}>
              {cfg.dateLabel} <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={newDeliveryDate}
                min={toInputDate(new Date(today.getTime() + 86400000))}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
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
              {cfg.dateHint}
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
            onClick={() => isValid && onConfirm(newDeliveryDate)}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: isValid ? cfg.buttonBg : '#D1D5DB',
              border: 'none', borderRadius: '6px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { if (isValid) e.currentTarget.style.backgroundColor = cfg.buttonHover; }}
            onMouseLeave={e => { if (isValid) e.currentTarget.style.backgroundColor = cfg.buttonBg; }}
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
