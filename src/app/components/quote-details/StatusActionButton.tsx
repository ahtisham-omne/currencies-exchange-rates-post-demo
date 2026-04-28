import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Send, CheckCircle2, Ban, FileCheck, RotateCcw, AlertTriangle, RefreshCw, Copy, CheckSquare } from 'lucide-react';
import { QuoteLifecycleStatus } from './ModernStatusStepper';
import { toast } from 'sonner';

interface StatusActionButtonProps {
  currentStatus: QuoteLifecycleStatus;
  onStatusChange: (status: QuoteLifecycleStatus, reason?: string) => void;
  onCancelConverted?: () => void;
  onReviveExpired?: () => void;
  onDuplicate?: () => void;
  onReviveCancelled?: () => void;
  onSendToCustomer?: () => void;
  onResendToCustomer?: () => void;
  salesOrderNumber?: string | null;
}

interface StatusOption {
  label: string;
  status: QuoteLifecycleStatus;
  icon: typeof Send;
  color: string;
  bgColor: string;
  description: string;
  requiresReason?: boolean;
  reasonTitle?: string;
  reasonPlaceholder?: string;
  action?: 'send' | 'markSent' | 'resend';
}

const getStatusOptions = (currentStatus: QuoteLifecycleStatus): { primary: StatusOption | null; secondary: StatusOption[] } => {
  switch (currentStatus) {
    case 'draft':
      return {
        primary: {
          label: 'Send to Customer',
          status: 'sent',
          icon: Send,
          color: '#1E40AF',
          bgColor: '#DBEAFE',
          description: 'Preview quote PDF and send to customer',
          action: 'send',
        },
        secondary: [
          {
            label: 'Mark as Sent',
            status: 'sent',
            icon: CheckSquare,
            color: '#1E40AF',
            bgColor: '#DBEAFE',
            description: 'Mark as sent without emailing customer',
            action: 'markSent',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: '#991B1B',
            bgColor: '#FEE2E2',
            description: 'Permanently cancel this quote',
            requiresReason: true,
            reasonTitle: 'Cancel Quote',
            reasonPlaceholder: 'Why is this quote being cancelled? e.g., Customer withdrew interest, pricing no longer valid...',
          },
        ],
      };
    case 'sent':
      return {
        primary: {
          label: 'Confirmed by Customer',
          status: 'confirmed',
          icon: CheckCircle2,
          color: '#0D9488',
          bgColor: '#CCFBF1',
          description: 'Customer confirmed — becomes the current version',
        },
        secondary: [
          {
            label: 'Resend to Customer',
            status: 'sent',
            icon: Send,
            color: '#1E40AF',
            bgColor: '#DBEAFE',
            description: 'Send updated quote document to customer',
            action: 'resend',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: '#374151',
            bgColor: '#F3F4F6',
            description: 'Cancel this quote entirely',
            requiresReason: true,
            reasonTitle: 'Cancel Quote',
            reasonPlaceholder: 'Why is this quote being cancelled?',
          },
        ],
      };
    case 'confirmed':
      return {
        primary: {
          label: 'Convert to SO',
          status: 'converted',
          icon: FileCheck,
          color: '#047857',
          bgColor: '#D1FAE5',
          description: 'Convert to sales order',
        },
        secondary: [
          {
            label: 'Resend to Customer',
            status: 'sent',
            icon: Send,
            color: '#1E40AF',
            bgColor: '#DBEAFE',
            description: 'Resend quote document to customer',
            action: 'resend',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: '#991B1B',
            bgColor: '#FEE2E2',
            description: 'Cancel before SO conversion',
            requiresReason: true,
            reasonTitle: 'Cancel Quote',
            reasonPlaceholder: 'Reason for cancellation before conversion?',
          },
        ],
      };
    case 'converted':
      return { primary: null, secondary: [] };
    case 'cancelled':
      return { primary: null, secondary: [] };
    case 'archived':
      return {
        primary: {
          label: 'Reopen as Draft',
          status: 'draft',
          icon: RotateCcw,
          color: '#374151',
          bgColor: '#F3F4F6',
          description: 'Unarchive and reopen this quote',
        },
        secondary: [],
      };
    case 'expired':
      return {
        primary: {
          label: 'Reactivate Quote',
          status: 'sent',
          icon: RefreshCw,
          color: '#DC2626',
          bgColor: '#FEE2E2',
          description: 'Extend dates and resend this expired quote',
        },
        secondary: [
          {
            label: 'Reopen as Draft',
            status: 'draft',
            icon: RotateCcw,
            color: '#374151',
            bgColor: '#F3F4F6',
            description: 'Reopen as a new draft for further editing',
          },
        ],
      };
    default:
      return { primary: null, secondary: [] };
  }
};

// ── Reason Modal ──────────────────────────────────────────────────
function ReasonModal({ option, onConfirm, onClose }: {
  option: StatusOption;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const isCancel = option.status === 'cancelled';
  const accentColor = '#991B1B';
  const accentBg = '#FEF2F2';
  const ModalIcon = option.icon;

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
          backgroundColor: '#FFFFFF', borderRadius: '12px', width: '460px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)', fontFamily: 'Inter, system-ui, sans-serif',
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
            backgroundColor: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ModalIcon style={{ width: '16px', height: '16px', color: accentColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
              {option.reasonTitle}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px', lineHeight: '1' }}>
              {option.description}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'flex', gap: '10px', padding: '10px 12px',
            backgroundColor: '#FFFBEB', borderRadius: '8px',
            borderWidth: '1px', borderStyle: 'solid', borderColor: '#FDE68A',
            marginBottom: '16px',
          }}>
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
              {isCancel
                ? 'This will cancel the quote and notify all associated parties. You can reactivate it later as a new draft version, or duplicate it.'
                : 'This action requires a reason. The reason will be recorded in the version history and activity log.'}
            </div>
          </div>

          <label style={{
            fontSize: '11px', fontWeight: 600, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            display: 'block', marginBottom: '6px', lineHeight: '1',
          }}>
            Reason <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={option.reasonPlaceholder}
            autoFocus
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', fontSize: '13px', color: '#1F2937',
              borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
              borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5',
              resize: 'vertical', minHeight: '72px', boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1' }}>
            This reason will be logged in activity and visible in version history.
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
              backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
              borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: '1', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
              color: '#FFFFFF', backgroundColor: accentColor,
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#7F1D1D'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = accentColor; }}
          >
            <ModalIcon style={{ width: '13px', height: '13px' }} />
            {isCancel ? 'Cancel Quote' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function StatusActionButton({ currentStatus, onStatusChange, onCancelConverted, onReviveExpired, onDuplicate, onReviveCancelled, onSendToCustomer, onResendToCustomer, salesOrderNumber }: StatusActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<StatusOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { primary, secondary } = getStatusOptions(currentStatus);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!primary) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {currentStatus === 'cancelled' && onReviveCancelled && (
          <button
            onClick={onReviveCancelled}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 14px',
              borderRadius: '6px', border: 'none', backgroundColor: 'rgba(39, 185, 115, 1)',
              color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              lineHeight: '1', whiteSpace: 'nowrap', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(30, 160, 98, 1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(39, 185, 115, 1)'; }}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            Reactivate Quote
          </button>
        )}
        {onCancelConverted && currentStatus !== 'cancelled' && (
          <button
            onClick={onCancelConverted}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 14px',
              borderRadius: '6px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.9)',
              backgroundColor: 'rgba(255,255,255,0.95)', color: '#DC2626', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', lineHeight: '1', whiteSpace: 'nowrap', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#991B1B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.9)'; e.currentTarget.style.color = '#DC2626'; }}
          >
            <Ban style={{ width: '13px', height: '13px' }} />
            Cancel Quote
          </button>
        )}
      </div>
    );
  }

  const isTerminal = currentStatus === 'cancelled' || currentStatus === 'archived' || currentStatus === 'expired';

  const PrimaryIcon = primary.icon;

  const handleOptionClick = (option: StatusOption) => {
    setIsOpen(false);
    if (option.action === 'resend' && onResendToCustomer) {
      onResendToCustomer();
      return;
    }
    if (option.action === 'markSent') {
      // Mark as sent without sending — transition directly
      onStatusChange(option.status);
      toast.success('Quote marked as sent', {
        description: 'Status updated without sending email to customer.',
        position: 'top-right',
      });
      return;
    }
    if (option.requiresReason) {
      setReasonModal(option);
    } else {
      onStatusChange(option.status);
    }
  };

  const handlePrimaryClick = () => {
    if (primary.action === 'send' && onSendToCustomer) {
      onSendToCustomer();
      return;
    }
    if (currentStatus === 'expired' && onReviveExpired) {
      onReviveExpired();
      return;
    }
    if (primary.requiresReason) {
      setReasonModal(primary);
    } else {
      onStatusChange(primary.status);
    }
  };

  const handleReasonConfirm = (reason: string) => {
    if (!reasonModal) return;
    const statusLabel = reasonModal.status === 'cancelled' ? 'cancelled' : reasonModal.status;
    toast.success(`Quote ${statusLabel}`, {
      description: reason,
      position: 'top-right',
    });
    onStatusChange(reasonModal.status, reason);
    setReasonModal(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Main button */}
          <button
            onClick={handlePrimaryClick}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px',
              borderRadius: secondary.length > 0 ? '6px 0 0 6px' : '6px',
              backgroundColor: currentStatus === 'expired' ? '#DC2626' : isTerminal ? '#FFFFFF' : 'rgba(39, 185, 115, 1)',
              color: currentStatus === 'expired' ? '#FFFFFF' : isTerminal ? '#374151' : '#FFFFFF',
              border: currentStatus === 'expired' ? 'none' : isTerminal ? '1px solid #E5E7EB' : 'none',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
              lineHeight: '1', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (currentStatus === 'expired') e.currentTarget.style.backgroundColor = '#B91C1C';
              else if (isTerminal) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }
              else e.currentTarget.style.backgroundColor = 'rgba(30, 160, 98, 1)';
            }}
            onMouseLeave={(e) => {
              if (currentStatus === 'expired') e.currentTarget.style.backgroundColor = '#DC2626';
              else if (isTerminal) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }
              else e.currentTarget.style.backgroundColor = 'rgba(39, 185, 115, 1)';
            }}
          >
            <PrimaryIcon style={{ width: '13px', height: '13px' }} />
            {primary.label}
          </button>

          {/* Dropdown trigger */}
          {secondary.length > 0 && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '32px',
                borderRadius: '0 6px 6px 0',
                backgroundColor: currentStatus === 'expired' ? '#DC2626' : 'rgba(39, 185, 115, 1)',
                color: '#FFFFFF', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = currentStatus === 'expired' ? '#B91C1C' : 'rgba(30, 160, 98, 1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = currentStatus === 'expired' ? '#DC2626' : 'rgba(39, 185, 115, 1)'; }}
            >
              <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && secondary.length > 0 && (
          <div
            className="absolute top-full right-0 mt-1 bg-white z-50"
            style={{
              width: '280px', borderRadius: '8px', border: '1px solid #E5E7EB',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '4px' }}>
              {secondary.map((option, index) => {
                const Icon = option.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    className="flex items-center gap-3 w-full text-left transition-colors"
                    style={{
                      padding: '8px 10px', borderRadius: '6px', border: 'none',
                      backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', backgroundColor: option.bgColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon style={{ width: '14px', height: '14px', color: option.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: option.color === '#991B1B' ? '#991B1B' : '#1F2937', lineHeight: '1', marginBottom: '5px' }}>
                        {option.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>
                        {option.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reason modal */}
      {reasonModal && (
        <ReasonModal
          option={reasonModal}
          onConfirm={handleReasonConfirm}
          onClose={() => setReasonModal(null)}
        />
      )}
    </>
  );
}
