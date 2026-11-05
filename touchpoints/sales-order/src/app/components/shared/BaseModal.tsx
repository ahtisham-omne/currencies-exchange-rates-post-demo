/**
 * BaseModal — Single source of truth for module modals.
 *
 * Codifies Partner Management's modal chrome so every dialog in the module
 * uses identical surface, header, footer, padding, and z-stacking. Drop this
 * around any modal body and you get the canonical appearance for free.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  Title              ╳        │  ← header (icon + title + close)
 *   │  optional subtitle           │
 *   ├─────────────────────────────┤
 *   │  body  (scrollable)          │
 *   ├─────────────────────────────┤
 *   │  Cancel              Save    │  ← optional footer
 *   └─────────────────────────────┘
 *
 * Use `ConfirmationModal` (separate) for centred-icon confirm dialogs.
 * Use this for everything else (forms, selectors, configurators).
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional one-line subtitle below the title. */
  subtitle?: string;
  /** Optional icon to render in the title row (rendered in a 24-px tinted square). */
  icon?: React.ReactNode;
  /** Modal width preset. */
  width?: 'sm' | 'md' | 'lg' | 'xl';
  /** Body content. The body has its own scroll if it overflows. */
  children: React.ReactNode;
  /** Optional footer (typically left = secondary action, right = primary CTA). */
  footer?: React.ReactNode;
  /** Pad/strip the body so consumers can render edge-to-edge content. */
  bodyClassName?: string;
  /** Hide the close (X) button — useful if footer Cancel is the only escape. */
  hideClose?: boolean;
  /** Extra controls in the header, left of the close button. Partner's own
   *  modals put Full view / help affordances here, so callers get that slot
   *  instead of building a second header. */
  headerActions?: React.ReactNode;
  /** Stack-order. Default 12000 sits above content modals; bump for nested. */
  zIndex?: number;
}

const WIDTHS: Record<NonNullable<BaseModalProps['width']>, string> = {
  sm: 'min(400px, calc(100vw - 32px))',
  md: 'min(520px, calc(100vw - 32px))',
  lg: 'min(720px, calc(100vw - 32px))',
  xl: 'min(960px, calc(100vw - 48px))',
};

export function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  width = 'md',
  children,
  footer,
  bodyClassName,
  hideClose,
  headerActions,
  zIndex = 12000,
}: BaseModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative flex flex-col bg-card"
        style={{
          width: WIDTHS[width],
          maxHeight: 'min(720px, calc(100vh - 64px))',
          borderRadius: 16,
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
          /* No `overflow-hidden` here: child popovers (date pickers,
             select dropdowns inside the modal body) need to extend past
             the modal bounds without being clipped. The body has its own
             `overflow-y-auto` for long forms, and consumers that want
             edge-to-edge clipping can opt in via `bodyClassName`. */
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between shrink-0"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}
        >
          <div className="flex items-start min-w-0" style={{ gap: 10 }}>
            {icon && (
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--accent)', marginTop: 1 }}
              >
                {React.isValidElement(icon)
                  ? React.cloneElement(icon as React.ReactElement, {
                      className: 'text-primary',
                      style: { width: 16, height: 16, ...(icon as React.ReactElement).props?.style },
                    } as React.HTMLAttributes<HTMLElement>)
                  : icon}
              </div>
            )}
            <div className="min-w-0">
              <h3
                className="truncate"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {title}
              </h3>
              {subtitle && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--muted-foreground)',
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
          {!hideClose && (
            <button
              onClick={onClose}
              className="hover:bg-secondary shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 0,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
              }}
              aria-label="Close"
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
          </div>
        </div>

        {/* ── Body ── Partner-style light-gray surface so the modal
            chrome (header/footer in white) reads as a frame around the
            workspace, matching the Partner Management visual language. */}
        <div
          className={bodyClassName ?? 'overflow-y-auto'}
          style={bodyClassName ? undefined : { padding: '16px 20px', flex: 1, background: 'var(--background)' }}
        >
          {children}
        </div>

        {/* ── Footer ── */}
        {footer && (
          <div
            className="flex items-center justify-end shrink-0"
            style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', gap: 8 }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────────────────────────────────────────────────────────────────
 *  Footer button helpers — partner-aligned styles (rounded-lg, h-9, 13px,
 *  semibold for primary). Use these in any BaseModal footer to stay
 *  consistent without re-declaring colors per modal.
 * ─────────────────────────────────────────────────────────────────────────── */

export function ModalSecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors"
      style={{
        height: 36,
        padding: '0 14px',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ModalPrimaryButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'destructive';
}) {
  const bg = variant === 'destructive' ? 'hsl(var(--destructive))' : 'var(--primary)';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg text-white transition-opacity hover:opacity-90"
      style={{
        height: 36,
        padding: '0 16px',
        fontSize: 13,
        fontWeight: 600,
        backgroundColor: disabled ? 'var(--muted)' : bg,
        color: disabled ? 'var(--muted-foreground)' : '#FFFFFF',
        border: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
