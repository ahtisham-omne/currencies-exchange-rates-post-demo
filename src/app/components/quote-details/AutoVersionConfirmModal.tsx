import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitBranch, AlertTriangle, ArrowRight } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════
   Auto-Version confirmation — Partner-faithful redesign.

   Visual structure mirrors Partner's PaymentTermDetailModal pending
   confirmation pattern (gradient header with glow + large icon badge,
   uppercase action badge, centered title + description, vertical
   full-width action buttons).

   Adds a small Reason field below the change summary so version-log
   entries can carry the author's intent. `onConfirm` accepts the
   trimmed reason; callers that don't care can ignore it.

   Version number is deterministic — always `currentVersion + 1`.
   ════════════════════════════════════════════════════════════════════ */

interface AutoVersionConfirmModalProps {
  isOpen: boolean;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
  currentVersion: number;
  fromStatus: string;
  onConfirm: (reason?: string) => void;
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
  const [reason, setReason] = useState('');
  /* Two-layer guard against double-version creation:
     · `isConfirming` (state) → re-renders the button as visually
       disabled so the user gets feedback.
     · `confirmingRef` (ref) → synchronously latches in the click
       handler so a fast double-click cannot re-enter `onConfirm`
       between the first call and React's commit. State alone wasn't
       enough — two `click` events from a double-click fire before
       React processes the first `setIsConfirming(true)`, so both
       handler invocations passed the state-only check. */
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setIsConfirming(false);
    confirmingRef.current = false;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDiscard(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onDiscard]);

  if (!isOpen) return null;

  /* Deterministic next-version label. quoteVersion lives in parent
     state and is single-source-of-truth for the document. */
  const newVersion = currentVersion + 1;

  /* Portalled to document.body so `position: fixed` always anchors to
     the viewport, even if an ancestor introduces a containing block
     (e.g. via `transform`/`filter`/`will-change`). Without the portal
     the modal would silently crop inside such an ancestor. */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDiscard(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.40)',
        backdropFilter: 'blur(2px)',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 480, maxWidth: '90vw',
          background: '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
        }}
      >
        {/* Gradient header with glow + large icon + badge */}
        <div
          className="relative flex flex-col items-center pt-9 pb-5"
          style={{
            background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,255,255,0.30) 70%, transparent 100%)',
          }}
        >
          <div
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              width: 180, height: 80, borderRadius: 999,
              filter: 'blur(50px)',
              opacity: 0.25,
              backgroundColor: '#F59E0B',
            }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
          >
            <AlertTriangle className="w-8 h-8" />
          </div>
          <span
            className="mt-3 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: '#FFFBEB',
              color: '#92400E',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Material change
          </span>
        </div>

        {/* Body — centered title + description, then change summary + reason */}
        <div className="flex flex-col items-center text-center px-7 pb-7">
          <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: '#0F172A' }}>
            Create V{newVersion} draft?
          </h3>
          <p
            className="text-[13px] mt-2 max-w-[400px]"
            style={{ color: '#64748B', lineHeight: 1.65 }}
          >
            This quote is currently <strong style={{ color: '#0F172A', fontWeight: 600 }}>{fromStatus}</strong>.
            Saving this change starts a new draft (V{newVersion}). You can keep editing afterwards.
          </p>

          {/* Change summary card */}
          <div
            className="w-full mt-5 rounded-lg text-left"
            style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid rgba(217, 119, 6, 0.30)',
              padding: '10px 14px',
            }}
          >
            <div
              className="text-[11px]"
              style={{
                fontWeight: 600,
                color: '#92400E',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Change
            </div>
            <div className="text-[13px] mt-1" style={{ fontWeight: 600, color: '#0F172A' }}>
              {fieldLabel}
            </div>
            {(oldValue || newValue) && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {oldValue && (
                  <span
                    className="text-[12px] line-through truncate"
                    style={{
                      maxWidth: 180,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(220,38,38,0.12)',
                      color: '#991B1B',
                      fontWeight: 500,
                    }}
                  >
                    {oldValue}
                  </span>
                )}
                {oldValue && newValue && (
                  <ArrowRight className="w-3 h-3" style={{ color: '#94A3B8' }} />
                )}
                {newValue && (
                  <span
                    className="text-[12px] truncate"
                    style={{
                      maxWidth: 180,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(5,150,105,0.12)',
                      color: '#065F46',
                      fontWeight: 500,
                    }}
                  >
                    {newValue}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason field — optional note logged with the new version */}
          <div className="w-full mt-4 text-left">
            <label
              htmlFor="auto-version-reason"
              className="text-[12px] block mb-1.5"
              style={{ fontWeight: 500, color: '#334155' }}
            >
              Reason <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="auto-version-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why are you making this change? (Appears in the version log.)"
              className="w-full rounded-lg bg-white text-[13px] resize-none"
              style={{
                padding: '8px 10px',
                lineHeight: 1.5,
                color: '#0F172A',
                border: '1px solid #E2E8F0',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0A77FF';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,119,255,0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Vertical full-width actions — Partner pattern.
              Reason is optional; confirm is only blocked while an in-flight
              confirm is pending to defend against double-clicks. */}
          <div className="w-full mt-5 flex flex-col gap-2.5">
            {(() => {
              const isDisabled = isConfirming;
              return (
                <button
                  type="button"
                  onClick={isDisabled ? undefined : () => {
                    /* Ref-latch BEFORE invoking onConfirm. The state
                       version is for UI only; the ref is what
                       blocks the second click event from a double-
                       click. */
                    if (confirmingRef.current) return;
                    confirmingRef.current = true;
                    setIsConfirming(true);
                    onConfirm(reason.trim());
                  }}
                  disabled={isDisabled}
                  className="w-full h-11 text-[14px] rounded-xl transition-colors flex items-center justify-center gap-2"
                  style={{
                    fontWeight: 600,
                    backgroundColor: '#F59E0B',
                    color: '#FFFFFF',
                    border: 'none',
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <GitBranch className="w-4 h-4" />
                  Create V{newVersion} draft
                </button>
              );
            })()}
            <button
              type="button"
              onClick={onDiscard}
              className="w-full h-11 text-[14px] rounded-xl cursor-pointer transition-colors"
              style={{
                fontWeight: 500,
                backgroundColor: '#F1F5F9',
                color: '#334155',
                border: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            >
              Discard change
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
