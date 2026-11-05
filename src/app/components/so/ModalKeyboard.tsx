import { useEffect, useCallback } from "react";

/**
 * ═══ Modal Keyboard Shortcuts — Reusable hook & badge components ═══
 *
 * useModalShortcuts  — binds ⌘↵ (Mac) / Ctrl+↵ (Win) for confirm + Escape for close
 * KbdHint            — renders a keyboard‑hint badge (e.g. "Esc", "⌘↵")
 * ModalShell         — optional shell wrapper providing backdrop + centered container
 *
 * All typography uses CSS variable tokens from the design system (Inter font faces only).
 */

/* ═══════════════════════════════════════════════════════════════════
 *  Hook: useModalShortcuts
 * ═══════════════════════════════════════════════════════════════════ */
interface UseModalShortcutsOptions {
  /** Called on ⌘↵ / Ctrl+Enter — the primary confirm action. */
  onConfirm?: () => void;
  /** Called on Escape — the dismiss/close action. */
  onClose?: () => void;
  /** When true, ⌘↵ is a no-op (button disabled state). */
  confirmDisabled?: boolean;
}

export function useModalShortcuts({ onConfirm, onClose, confirmDisabled }: UseModalShortcutsOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Escape → close
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }
      // ⌘↵ or Ctrl+Enter → confirm
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (confirmDisabled) return;
        e.preventDefault();
        e.stopPropagation();
        onConfirm?.();
      }
    },
    [onConfirm, onClose, confirmDisabled],
  );

  useEffect(() => {
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [handler]);
}

/* ═══════════════════════════════════════════════════════════════════
 *  Component: KbdHint — tokenised keyboard‑shortcut badge
 * ═══════════════════════════════════════════════════════════════════
 *
 *  <KbdHint keys="⌘↵" />
 *  <KbdHint keys="Esc" />
 *  <KbdHint keys="⌘↵" variant="light" />   ← for dark‑bg buttons
 */
type KbdVariant = "muted" | "light";

export function KbdHint({ keys, variant = "muted" }: { keys: string; variant?: KbdVariant }) {
  const cls =
    variant === "light"
      ? "text-small font-normal opacity-50"
      : "text-foreground/25 text-small font-normal";

  return (
    <kbd
      className={cls}
      style={{
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {keys}
    </kbd>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Component: ModalShell — backdrop + centered container
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Provides the fixed overlay + card shell used by every SO modal.
 *  Pass children for the header / body / footer.
 *
 *  <ModalShell onClose={…} maxWidth={640}>
 *    {header}
 *    {body}
 *    {footer}
 *  </ModalShell>
 */
interface ModalShellProps {
  /** Close callback — also wired to backdrop click + Escape. */
  onClose: () => void;
  /** Maximum width of the card (number → px, or CSS string). Default 520. */
  maxWidth?: number | string;
  /** Extra className on the card container. */
  className?: string;
  /** Max-height CSS value. Default "85vh". */
  maxHeight?: string;
  children: React.ReactNode;
}

export function ModalShell({ onClose, maxWidth = 520, maxHeight = "85vh", className = "", children }: ModalShellProps) {
  const mw = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className={`relative bg-card rounded-lg border border-border w-full flex flex-col ${className}`}
        style={{ boxShadow: "var(--elevation-3)", maxWidth: mw, maxHeight }}
      >
        {children}
      </div>
    </div>
  );
}