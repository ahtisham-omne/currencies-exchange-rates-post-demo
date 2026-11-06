import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmationModal — Partner Management's centered-icon confirmation pattern.
 *
 * Mirrors the Archive / Deactivate dialogs in
 * Partner Management - Vendors → ContactsDirectoryPage. Surface, gradient,
 * blurred glow, full-width primary CTA over a muted Cancel — the same
 * treatment used by the AttachmentCard delete-confirm so every
 * confirmation in the module looks identical.
 *
 * Variants (icon + glow + pill + primary-CTA color):
 *   • red       — Caution  (destructive actions: delete, archive, remove)
 *   • yellow    — Warning  (cautionary actions: deactivate, unapply)
 *   • blue      — Heads-up (neutral, primary)
 */

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  /** Plain string. If you need to highlight a name, pass it via `highlight`. */
  message: string;
  /** Optional name/value to render bold inside the message (e.g. file/contact). */
  highlight?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'blue' | 'yellow' | 'red';
  /** Icon shown inside the centered, tinted rounded square. */
  icon?: React.ReactNode;
  /** Optional z-index override. Defaults to 12200. Bump above the host
   *  modal (e.g. 12300) when this confirmation opens from inside another
   *  Dialog-portal'd modal so it doesn't render behind. */
  zIndex?: number;
  /** Extra body content rendered between the message and the action
   *  buttons. Use this slot to inject a Reason textarea, sub-pills, or
   *  any other supporting input — keeps the Partner-style shell while
   *  letting destructive actions capture extra context. */
  children?: React.ReactNode;
  /** If true, disables the confirm button (e.g. when an input is invalid). */
  confirmDisabled?: boolean;
  /** Where to render the `children` slot.
   *  - `middle` (default): legacy Partner-v7 order — Confirm, then children, then Cancel.
   *  - `before-actions`: form fields render above both buttons — used
   *    for structured-input flows (Reject Quote) where a button sitting
   *    between fields is disorienting.
   *  - `after-actions`: Confirm + Cancel grouped at the top, then a visible
   *    gap, then children rendered below as a tertiary path. Used when the
   *    slotted action is a sideways escape hatch (e.g. "Clear and decide
   *    later") that shouldn't sit between the two primary choices. */
  slotPosition?: 'middle' | 'before-actions' | 'after-actions';
  /** Modal width. `default` (400px) for pure text confirmations;
   *  `wide` (480px) for structured-input flows (Reject Quote) so
   *  the reason dropdown + textarea + attachment field aren't
   *  cramped. */
  size?: 'default' | 'wide';
}

/* Note: our theme defines tokens like `--primary` and `--destructive`
   as raw hex strings (e.g. `#0A77FF`), not HSL components. Wrapping
   them in `hsl(var(--primary))` would produce invalid CSS and render
   transparent — so we use the var directly without `hsl()`. */
const VARIANT_TOKENS = {
  red: {
    glow: '#EF4444',
    iconBg: '#FEE2E2',
    iconColor: 'var(--destructive)',
    pillLabel: 'Caution',
    pillBg: '#FEF2F2',
    pillColor: '#991B1B',
    gradient: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)',
    ctaBg: 'var(--destructive)',
  },
  yellow: {
    glow: '#EAB308',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    pillLabel: 'Warning',
    pillBg: '#FEF9C3',
    pillColor: '#92400E',
    gradient: 'linear-gradient(180deg, #FEFCE8 0%, rgba(254,252,232,0.3) 70%, transparent 100%)',
    ctaBg: '#F97316',
  },
  blue: {
    glow: '#3B82F6',
    iconBg: '#DBEAFE',
    iconColor: '#1D4ED8',
    pillLabel: 'Heads up',
    pillBg: '#EFF6FF',
    pillColor: '#1E40AF',
    gradient: 'linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)',
    ctaBg: 'var(--primary)',
  },
} as const;

export function ConfirmationModal({
  isOpen,
  title,
  message,
  highlight,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'red',
  icon,
  zIndex = 12200,
  children,
  confirmDisabled = false,
  slotPosition = 'middle',
  size = 'default',
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') {
        // Don't hijack Enter while the user is typing in the slotted
        // textarea — they need it to insert newlines in their reason.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
        if (!confirmDisabled) onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, onConfirm, confirmDisabled]);

  if (!isOpen) return null;

  const t = VARIANT_TOKENS[variant];

  /* Render into document.body via createPortal so the zIndex is
     evaluated in the body stacking context — otherwise the modal
     would be trapped inside the parent's stacking context (e.g. the
     manage-rules modal at zIndex 12000) and could not rise above
     sibling portals like the items sub-modal at zIndex 12250. */
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col overflow-hidden bg-white"
        style={{
          width: size === 'wide' ? 'min(480px, calc(100vw - 32px))' : 'min(400px, calc(100vw - 32px))',
          borderRadius: '16px',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tinted gradient strip with glow + icon + pill */}
        <div
          className="relative flex flex-col items-center"
          style={{ padding: '40px 0 24px', background: t.gradient }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: 9999, filter: 'blur(50px)', opacity: 0.25, backgroundColor: t.glow }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.iconBg }}
          >
            {icon
              ? React.cloneElement(icon as React.ReactElement, { style: { width: 32, height: 32, color: t.iconColor } } as React.HTMLAttributes<HTMLElement>)
              : <AlertTriangle style={{ width: 32, height: 32, color: t.iconColor }} />
            }
          </div>
          <span
            className="mt-4"
            style={{
              padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
              backgroundColor: t.pillBg, color: t.pillColor,
              textTransform: 'none',
            }}
          >
            {t.pillLabel}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center" style={{ padding: '0 32px 32px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em', margin: 0 }}>
            {title}
          </h3>
          <p
            style={{
              fontSize: 13, color: 'var(--muted-foreground)',
              marginTop: 8, lineHeight: 1.65, maxWidth: 300,
            }}
          >
            {highlight && (
              <>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>{highlight}</span>{' '}
              </>
            )}
            {message}
          </p>

          {/* Form fields (before-actions slot) — render above both
              buttons for structured-input flows so a CTA never sits
              between form controls. */}
          {slotPosition === 'before-actions' && children && (
            <div className="w-full text-left" style={{ marginTop: 20 }}>
              {children}
            </div>
          )}
          {/* Button stack — Partner v7 confirmation-modal order:
               1. Primary CTA on top (filled red for destructive),
               2. Optional slotted secondary path (middle) as a quiet
                  outlined affordance,
               3. Cancel/Keep-editing at the bottom on a muted fill.
              All three share the same h-11 rounded-xl shape so the
              hierarchy reads at a glance instead of dissolving into
              plain text. */}
          <div className="w-full flex flex-col" style={{ marginTop: slotPosition === 'before-actions' ? 20 : 28, gap: 10 }}>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="w-full cursor-pointer transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600,
                backgroundColor: t.ctaBg, color: '#FFFFFF', border: 0,
              }}
            >
              {confirmText}
            </button>
            {slotPosition === 'middle' && children && (
              <div className="w-full text-left">
                {children}
              </div>
            )}
            <button
              onClick={onCancel}
              className="w-full cursor-pointer transition-colors"
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 500,
                backgroundColor: 'var(--muted)', color: '#334155', border: 0,
              }}
            >
              {cancelText}
            </button>
            {slotPosition === 'after-actions' && children && (
              <div className="w-full text-left" style={{ marginTop: 14 }}>
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
