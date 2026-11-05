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
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, onConfirm]);

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
          width: 'min(400px, calc(100vw - 32px))',
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

          <div className="w-full flex flex-col" style={{ marginTop: 28, gap: 10 }}>
            <button
              onClick={onConfirm}
              className="w-full cursor-pointer transition-colors hover:opacity-90"
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600,
                backgroundColor: t.ctaBg, color: '#FFFFFF', border: 0,
              }}
            >
              {confirmText}
            </button>
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
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
