import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Send, CheckCircle2, Ban, FileCheck, RotateCcw, AlertTriangle, RefreshCw, Copy, CheckSquare, ThumbsDown } from 'lucide-react';
import { QuoteLifecycleStatus } from './ModernStatusStepper';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PartnerAttachmentField } from '@/app/components/shared/PartnerAttachmentField';
import { QUOTE_REJECTION_REASONS } from '@/app/types/quote';

interface StatusActionButtonProps {
  currentStatus: QuoteLifecycleStatus;
  /** `attachments` is populated only from the Mark Rejection flow; it
   *  carries the files the approver picked in the modal so
   *  `QuoteDetails` can persist them under the Rejection Attachments
   *  source. Other status transitions pass it undefined. */
  onStatusChange: (status: QuoteLifecycleStatus, reason?: string, attachments?: File[]) => void;
  onCancelConverted?: () => void;
  onReviveExpired?: () => void;
  onDuplicate?: () => void;
  onReviveCancelled?: () => void;
  onSendToCustomer?: () => void;
  onResendToCustomer?: () => void;
  salesOrderNumber?: string | null;
  /**
   * Runs before an action that moves a Draft forward without going through
   * `onSendToCustomer` (today: Mark as Sent). The parent either calls
   * `run` straight away or shows the inactive-items warning first and
   * calls it on confirm. Absent = run immediately, as before.
   */
  beforeAdvance?: (mode: 'markSent', run: () => void) => void;
  /** Run the primary action once on mount. Set when the quote was opened
   *  from the listing row menu's next-step item, so the row reuses this
   *  button's exact flow (send modal, convert modal, reactivate). */
  autoRunPrimary?: boolean;
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
  /** When provided, the reason modal renders a required dropdown of
   *  these values instead of a free-text-only field. Comments stay in
   *  the textarea and are mandatory only when the picked reason equals
   *  `commentsMandatoryReason` (default "Other") — or always mandatory
   *  when `commentsAlwaysMandatory` is true. */
  reasons?: readonly string[];
  commentsMandatoryReason?: string;
  commentsAlwaysMandatory?: boolean;
}

const getStatusOptions = (currentStatus: QuoteLifecycleStatus): { primary: StatusOption | null; secondary: StatusOption[] } => {
  switch (currentStatus) {
    case 'draft':
      return {
        primary: {
          label: 'Send to Customer',
          status: 'sent',
          icon: Send,
          color: 'var(--primary)',
          bgColor: 'var(--accent)',
          description: 'Preview quote PDF and send to customer',
          action: 'send',
        },
        secondary: [
          {
            label: 'Mark as Sent',
            status: 'sent',
            icon: CheckSquare,
            color: 'var(--primary)',
            bgColor: 'var(--accent)',
            description: 'Mark as sent without emailing customer',
            action: 'markSent',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: 'var(--destructive)',
            bgColor: 'rgba(220, 38, 38, 0.2)',
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
          color: 'var(--success)',
          bgColor: '#CCFBF1',
          description: 'Customer confirmed. Becomes the current version.',
        },
        secondary: [
          {
            /* Dropdown label reads as an action verb ("Mark
               Rejection"); the modal body carries the fuller "customer
               declined" explanation so it doesn't get repeated in the
               tight two-line row here. */
            label: 'Mark Rejection',
            status: 'rejected',
            icon: ThumbsDown,
            color: 'var(--destructive)',
            bgColor: 'rgba(220, 38, 38, 0.10)',
            description: 'Log a rejection on this quote',
            requiresReason: true,
            reasonTitle: 'Mark Rejection',
            reasonPlaceholder: 'Additional context',
            reasons: QUOTE_REJECTION_REASONS,
            /* Reason (dropdown) is the only required field —
               comments stay optional in every path, including
               "Other". Approvers who pick "Other" without adding a
               note just record the rejection as-is. */
          },
          {
            label: 'Resend to Customer',
            status: 'sent',
            icon: Send,
            color: 'var(--primary)',
            bgColor: 'var(--accent)',
            description: 'Send updated quote document to customer',
            action: 'resend',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: 'var(--foreground)',
            bgColor: 'var(--muted)',
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
          color: 'var(--success)',
          bgColor: 'rgba(5, 150, 105, 0.2)',
          description: 'Convert to sales order',
        },
        secondary: [
          {
            label: 'Resend to Customer',
            status: 'sent',
            icon: Send,
            color: 'var(--primary)',
            bgColor: 'var(--accent)',
            description: 'Resend quote document to customer',
            action: 'resend',
          },
          {
            label: 'Cancel Quote',
            status: 'cancelled',
            icon: Ban,
            color: 'var(--destructive)',
            bgColor: 'rgba(220, 38, 38, 0.2)',
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
          label: 'Reactivate Quote',
          status: 'draft',
          icon: RotateCcw,
          color: 'var(--foreground)',
          bgColor: 'var(--muted)',
          description: 'Restore this quote to the state it was in before archiving',
        },
        secondary: [],
      };
    case 'expired':
      return {
        primary: {
          label: 'Reactivate Quote',
          status: 'sent',
          icon: RefreshCw,
          color: 'var(--destructive)',
          bgColor: 'rgba(220, 38, 38, 0.2)',
          description: 'Extend dates and resend this expired quote',
        },
        secondary: [
          {
            label: 'Reopen as Draft',
            status: 'draft',
            icon: RotateCcw,
            color: 'var(--foreground)',
            bgColor: 'var(--muted)',
            description: 'Reopen as a new draft for further editing',
          },
        ],
      };
    default:
      return { primary: null, secondary: [] };
  }
};

// ── Reason Modal — Partner-style ConfirmationModal (red variant)
//    with reason capture slotted into the body. Two shapes:
//    • Free-text only (legacy cancel flow) — single textarea.
//    • Structured (option.reasons set) — required dropdown +
//      comments textarea, comments mandatory when the picked reason
//      equals `commentsMandatoryReason` (default "Other") or when
//      `commentsAlwaysMandatory` is true.
//    Callback receives the packed string "<Reason> — <Comments>" so
//    the existing onStatusChange(status, reason?) signature stays
//    intact; QuoteDetails splits it back into structured fields.
function ReasonModal({ option, onConfirm, onClose }: {
  option: StatusOption;
  onConfirm: (reason: string, attachments: File[]) => void;
  onClose: () => void;
}) {
  const structured = option.reasons && option.reasons.length > 0;
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const isCancel = option.status === 'cancelled';
  const isReject = option.status === 'rejected';
  const ModalIcon = option.icon;
  const titleText = isCancel
    ? 'Cancel this quote?'
    : isReject
      ? 'Mark Rejection'
      : `${option.reasonTitle}?`;
  const body = isCancel
    ? 'This will cancel the quote and notify all associated parties. You can reactivate it later as a new draft version, or duplicate it.'
    : isReject
      ? 'Logs a rejection on this quote. Reactivate it later on the same version to revise pricing or terms.'
      : 'This action will be recorded in the version history and activity log.';

  /* Both fields are optional for the reject flow — approvers can
     mark a rejection without picking a specific reason or writing
     a note. The CTA is always active in the structured path. */
  const isOtherReason = reason === 'Other';
  const disabled = false;

  const confirmLabel = isCancel ? 'Cancel quote' : isReject ? 'Mark rejection' : 'Confirm';
  const cancelLabel = isReject ? 'Keep active' : 'Keep as-is';

  return (
    <ConfirmationModal
      isOpen
      title={titleText}
      message={body}
      confirmText={confirmLabel}
      cancelText={cancelLabel}
      variant="red"
      icon={<ModalIcon />}
      onCancel={onClose}
      onConfirm={() => {
        if (structured) {
          const trimmed = comments.trim();
          /* Pack reason + comments with a period separator (no em-
             dash per the UX copy rule). Both are optional — if the
             approver leaves the dropdown blank we send just the
             comment; if the comment is blank we send just the
             reason; if both are blank we send an empty string.
             QuoteDetails parses this back into structured fields
             downstream. */
          const packed = reason && trimmed
            ? `${reason}. ${trimmed}`
            : reason || trimmed || '';
          onConfirm(packed, attachments);
        } else {
          onConfirm(reason.trim(), attachments);
        }
      }}
      confirmDisabled={disabled}
      /* Every reason-capture flow (Cancel + Reject) renders the form
         above the buttons — Partner's confirmation-modal layout. The
         legacy `middle` slot placed the primary CTA between the
         textarea and the Cancel button, which read as odd. */
      slotPosition="before-actions"
      size={structured ? 'wide' : 'default'}
    >
      {structured ? (
        <>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginBottom: 6 }}>
            Reason
          </label>
          {/* Partner-style Radix Select — replaces the native browser
              dropdown so the popover chrome matches every other
              reason/priority/tag picker in the app. */}
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full !bg-white">
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent className="!bg-white z-[12300]">
              {option.reasons!.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Comments field — always optional, even when "Other" is
              picked. The reason dropdown carries the required (*)
              flag; comments are helper context. */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginTop: 12, marginBottom: 6 }}>
            Comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={isOtherReason ? 'Type the specific reason (optional)' : option.reasonPlaceholder}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
              backgroundColor: 'var(--input-background, #ffffff)', resize: 'vertical', minHeight: 72,
              boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5,
            }}
          />

          <div style={{ marginTop: 14 }}>
            <PartnerAttachmentField files={attachments} onChange={setAttachments} />
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 10 }}>
            Logged in activity and stays visible on the reactivated draft.
          </div>
        </>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginBottom: 6 }}>
            Reason <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={option.reasonPlaceholder}
            autoFocus
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
              backgroundColor: 'var(--input-background, #ffffff)', resize: 'vertical', minHeight: 72,
              boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5,
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
            This reason will be logged in activity and visible in version history.
          </div>
        </>
      )}
    </ConfirmationModal>
  );
}

export function StatusActionButton({ currentStatus, onStatusChange, onCancelConverted, onReviveExpired, onDuplicate, onReviveCancelled, onSendToCustomer, onResendToCustomer, salesOrderNumber, beforeAdvance, autoRunPrimary = false }: StatusActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<StatusOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /* Portaled dropdown anchor — the header card uses `overflow:hidden` to
     clip its rounded corners, which clipped this menu when it was a
     normal absolutely-positioned child. Computing a fixed viewport
     position and rendering through a portal lets the menu escape every
     ancestor stacking / overflow context. */
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const { primary, secondary } = getStatusOptions(currentStatus);

  useEffect(() => {
    if (!isOpen) { setMenuPos(null); return; }
    const update = () => {
      const trigger = dropdownRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  /* Listing row "next step": run the primary action once. A cancelled
     quote has no primary; its next step is the Reactivate button. */
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!autoRunPrimary || autoRanRef.current) return;
    autoRanRef.current = true;
    if (primary) handlePrimaryClick();
    else if (currentStatus === 'cancelled' && onReviveCancelled) onReviveCancelled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunPrimary]);

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
              borderRadius: '6px', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(220, 38, 38, 0.5)',
              backgroundColor: '#FFFFFF', color: 'var(--destructive)', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', lineHeight: '1', whiteSpace: 'nowrap', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)'; e.currentTarget.style.borderColor = 'var(--destructive)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.5)'; }}
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
      const run = () => {
        onStatusChange(option.status);
        toast.success('Quote marked as sent', {
          description: 'Status updated without sending email to customer.',
          position: 'top-right',
        });
      };
      if (beforeAdvance) beforeAdvance('markSent', run);
      else run();
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

  const handleReasonConfirm = (reason: string, attachments: File[]) => {
    if (!reasonModal) return;
    const statusLabel = reasonModal.status === 'cancelled' ? 'cancelled' : reasonModal.status;
    toast.success(`Quote ${statusLabel}`, {
      description: attachments.length
        ? `${reason} · ${attachments.length} attachment${attachments.length === 1 ? '' : 's'} added`
        : reason,
      position: 'top-right',
    });
    /* Only the rejection flow forwards attachments — other reason
       captures (cancel, etc.) leave the third arg undefined so the
       receiver doesn't try to persist them. */
    onStatusChange(reasonModal.status, reason, reasonModal.status === 'rejected' ? attachments : undefined);
    setReasonModal(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Main button — Partner-aligned chrome (h-9 px-4 rounded-lg shadow-sm); green/destructive fill is the Quote-specific deviation.
              Tooltip surfaces `primary.description` on hover so users get a one-liner
              about exactly what this action does (e.g. "Preview quote PDF and send to customer"). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handlePrimaryClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px',
                  borderRadius: secondary.length > 0 ? '8px 0 0 8px' : '8px',
                  backgroundColor: currentStatus === 'expired' ? '#FFFFFF' : isTerminal ? '#FFFFFF' : 'rgba(39, 185, 115, 1)',
                  color: currentStatus === 'expired' ? 'var(--destructive)' : isTerminal ? 'var(--foreground)' : '#FFFFFF',
                  border: currentStatus === 'expired' ? '1px solid rgba(220, 38, 38, 0.5)' : isTerminal ? '1px solid var(--border)' : 'none',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                  lineHeight: '1', whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
                }}
                onMouseEnter={(e) => {
                  if (currentStatus === 'expired') { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)'; e.currentTarget.style.borderColor = 'var(--destructive)'; }
                  else if (isTerminal) { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }
                  else e.currentTarget.style.backgroundColor = 'rgba(30, 160, 98, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  if (currentStatus === 'expired') { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.5)'; }
                  else if (isTerminal) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; }
                  else e.currentTarget.style.backgroundColor = 'rgba(39, 185, 115, 1)';
                }}
              >
                <PrimaryIcon style={{ width: '14px', height: '14px' }} />
                {primary.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="!bg-white !text-slate-700 !border !border-border/80 !shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] z-[400] max-w-[280px] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed">
              <div style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 2 }}>{primary.label}</div>
              <div style={{ color: 'var(--muted-foreground)' }}>{primary.description}</div>
            </TooltipContent>
          </Tooltip>

          {/* Dropdown trigger — same chrome as primary, right-rounded only */}
          {secondary.length > 0 && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '36px',
                borderRadius: '0 8px 8px 0',
                backgroundColor: currentStatus === 'expired' ? '#FFFFFF' : 'rgba(39, 185, 115, 1)',
                color: currentStatus === 'expired' ? 'var(--destructive)' : '#FFFFFF',
                border: currentStatus === 'expired' ? '1px solid rgba(220, 38, 38, 0.5)' : 'none',
                borderLeft: currentStatus === 'expired' ? 'none' : '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', transition: 'background-color 150ms',
                boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = currentStatus === 'expired' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(30, 160, 98, 1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = currentStatus === 'expired' ? '#FFFFFF' : 'rgba(39, 185, 115, 1)'; }}
            >
              <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>

      </div>

      {/* Dropdown — portaled to document.body so it escapes the header's
          rounded `overflow:hidden` clip. Position is computed from the
          trigger's bounding rect. */}
      {isOpen && secondary.length > 0 && menuPos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="bg-white"
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 1000,
            width: '280px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px', backgroundColor: option.bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon style={{ width: '14px', height: '14px', color: option.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: option.color === 'var(--destructive)' ? 'var(--destructive)' : 'var(--foreground)', lineHeight: '1', marginBottom: '5px' }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                      {option.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}

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
