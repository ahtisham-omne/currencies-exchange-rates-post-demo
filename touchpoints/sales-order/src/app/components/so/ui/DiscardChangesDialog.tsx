import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban } from "lucide-react";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};
const microLabel: React.CSSProperties = {
  ...font,
  fontSize: "var(--text-small)",
  fontWeight: "var(--font-weight-semibold)",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};
const titleStyle: React.CSSProperties = {
  ...font,
  fontSize: "var(--text-base)",
  fontWeight: "var(--font-weight-semibold)",
};
const bodyStyle: React.CSSProperties = {
  ...font,
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-normal)",
  lineHeight: "1.6",
};

/* ═══════════════════════════════════════════════════════════════════
 *  ConfirmationDialog — generic centered confirmation overlay
 * ═══════════════════════════════════════════════════════════════════
 *  Matches the design system confirmation pattern:
 *  - Large subtle radial gradient glow behind the upper section of the card
 *  - Centered icon on a plain solid tinted circle
 *  - Micro badge label below icon (e.g. "DISCARD", "CANCEL")
 *  - Centered title + body text
 *  - Full-width stacked buttons (primary action + secondary dismiss)
 *  - All styling via CSS variables for central design-system control
 */

export interface ConfirmationDialogProps {
  open: boolean;
  icon?: React.ReactNode;
  badge?: string;
  title: string;
  description: string | string[];
  confirmLabel: string;
  dismissLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  variant?: "destructive" | "info";
  /** Extra content rendered between the description and buttons */
  extraContent?: React.ReactNode;
}

export function ConfirmationDialog({
  open,
  icon,
  badge = "DISCARD",
  title,
  description,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  variant = "destructive",
  extraContent,
}: ConfirmationDialogProps) {
  if (!open) return null;

  const descLines = Array.isArray(description) ? description : [description];
  const accentColor = variant === "info" ? "var(--primary)" : "var(--destructive)";
  const accentFg = variant === "info" ? "var(--primary-foreground)" : "var(--destructive-foreground)";
  const accentBgClass = variant === "info" ? "text-primary" : "text-destructive";
  const iconNode = icon ?? <AlertTriangle style={{ width: 28, height: 28, color: accentColor }} />;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: "var(--z-toast)" }}
      role="alertdialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={onDismiss} />

      {/* Card */}
      <div
        className="relative bg-card rounded-xl border border-border flex flex-col items-center overflow-hidden"
        style={{
          boxShadow: "var(--elevation-4)",
          width: 420,
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {/* Large subtle radial gradient — anchored at top-center, washes the upper ~60% of the card */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 120% 55% at 50% 0%, ${accentColor} 0%, transparent 100%)`,
            opacity: 0.10,
          }}
        />

        {/* Content area */}
        <div
          className="relative flex flex-col items-center w-full"
          style={{ padding: "32px 32px 24px" }}
        >
          {/* Icon on plain solid tinted circle */}
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              marginBottom: 12,
            }}
          >
            {/* Solid tinted background circle */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: accentColor,
                opacity: 0.1,
              }}
            />
            {/* Icon rendered on top */}
            <div className="relative">{iconNode}</div>
          </div>

          {/* Badge label */}
          <div className={accentBgClass} style={{ ...microLabel, marginBottom: 16 }}>
            {badge}
          </div>

          {/* Title */}
          <h3 className="text-foreground text-center" style={{ ...titleStyle, marginBottom: 8 }}>
            {title}
          </h3>

          {/* Body */}
          <div className="text-foreground/50 text-center" style={bodyStyle}>
            {descLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        {/* Extra content (e.g. effects list) */}
        {extraContent}

        {/* Buttons — stacked full-width */}
        <div className="w-full flex flex-col" style={{ padding: "0 32px 28px", gap: 8 }}>
          {/* Primary destructive action */}
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center rounded-lg transition-colors hover:opacity-90"
            style={{
              ...font,
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-weight-semibold)",
              padding: "12px 16px",
              background: accentColor,
              color: accentFg,
              border: "none",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>

          {/* Secondary dismiss */}
          <button
            onClick={onDismiss}
            className="w-full flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors"
            style={{
              ...font,
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-weight-medium)",
              padding: "12px 16px",
              background: "var(--card)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  DiscardChangesDialog — pre-configured ConfirmationDialog
 *  for discarding unsaved changes in creation / modification modals.
 * ═══════════════════════════════════════════════════════════════════ */

interface DiscardChangesDialogProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  /** Optional custom title — defaults to "Discard unsaved changes?" */
  title?: string;
}

export function DiscardChangesDialog({ open, onKeepEditing, onDiscard, title }: DiscardChangesDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      badge="DISCARD"
      title={title ?? "Discard unsaved changes?"}
      description={[
        "All the information you've entered will be lost.",
        "This action cannot be undone.",
      ]}
      confirmLabel="Discard changes"
      dismissLabel="Continue editing"
      onConfirm={onDiscard}
      onDismiss={onKeepEditing}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  CancellationConfirmDialog — pre-configured ConfirmationDialog
 *  for cancellation confirmation (replaces old type-to-confirm).
 * ═══════════════════════════════════════════════════════════════════ */

interface CancellationConfirmDialogProps {
  open: boolean;
  /** Number of lines being cancelled */
  selectedCount: number;
  /** Callback when cancellation is confirmed */
  onConfirm: () => void;
  /** Callback to go back / dismiss */
  onClose: () => void;
  /** Side-effect warnings to display in the confirmation */
  effects?: { icon: React.ReactNode; label: string }[];
}

export function CancellationConfirmDialog({ open, selectedCount, onConfirm, onClose, effects }: CancellationConfirmDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      icon={<Ban style={{ width: 28, height: 28, color: "var(--destructive)" }} />}
      badge="CANCEL"
      title="Confirm cancellation"
      description={[
        `Cancelling ${selectedCount} line item${selectedCount !== 1 ? "s" : ""}.`,
        "This action cannot be easily undone.",
      ]}
      confirmLabel="Confirm cancellation"
      dismissLabel="Go back"
      onConfirm={onConfirm}
      onDismiss={onClose}
      extraContent={effects && effects.length > 0 ? (
        <div style={{ width: "100%", padding: "0 32px 16px" }}>
          <div style={{
            backgroundColor: "#FFF7ED",
            border: "1px solid #FED7AA",
            borderRadius: "10px",
            padding: "14px 16px",
          }}>
            <div style={{
              fontSize: "var(--text-small)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#92400E",
              marginBottom: 10,
            }}>
              Effects of this action
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {effects.map((eff, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>{eff.icon}</div>
                  <span style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "#78350F",
                    lineHeight: 1.45,
                  }}>
                    {eff.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : undefined}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Hook: useDiscardGuard
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Usage:
 *    const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
 *
 *  - Call `guardedClose()` instead of `onClose()` on backdrop clicks,
 *    X buttons, Escape key, Cancel buttons, etc.
 *  - Render `{discardDialog}` anywhere inside the modal's portal.
 *  - When `isDirty` is false, `guardedClose` calls `onClose` directly.
 *  - When `isDirty` is true, it shows the discard confirmation first.
 */

interface DiscardGuard {
  /** Call this instead of onClose — will intercept when dirty */
  guardedClose: () => void;
  /** Whether the discard dialog is currently visible */
  showingDiscard: boolean;
  /** JSX element to render (the dialog itself) */
  discardDialog: React.ReactNode;
}

export function useDiscardGuard(isDirty: boolean, onClose: () => void, title?: string): DiscardGuard {
  const [showing, setShowing] = useState(false);

  const guardedClose = useCallback(() => {
    if (isDirty) {
      setShowing(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleKeepEditing = useCallback(() => setShowing(false), []);

  const handleDiscard = useCallback(() => {
    setShowing(false);
    onClose();
  }, [onClose]);

  const dialog = (
    <DiscardChangesDialog
      open={showing}
      onKeepEditing={handleKeepEditing}
      onDiscard={handleDiscard}
      title={title}
    />
  );

  return { guardedClose, showingDiscard: showing, discardDialog: dialog };
}