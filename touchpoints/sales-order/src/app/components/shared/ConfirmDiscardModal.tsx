import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

/**
 * Partner-aligned confirmation modal with semantic variants.
 *
 * Reference: Partner's CreatePartnerModal cancel-confirmation chrome
 * (rounded-2xl shell, gradient banner, glow icon, h-11 stacked buttons).
 *
 * Variants:
 *  - `destructive` (red)  → discard/delete/archive/cancel-converted/revert
 *  - `primary`     (blue) → generic confirmation (e.g. "Send to customer?")
 *  - `success`     (green)→ celebratory or post-action confirmation
 *  - `warning`     (amber)→ cautionary action that's not destructive
 */
type Variant = "destructive" | "primary" | "success" | "warning";

const VARIANT_TOKENS: Record<
  Variant,
  {
    bannerGradient: string;
    glow: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeFg: string;
    confirmBg: string;
    confirmHoverBg?: string;
    Icon: React.ElementType;
  }
> = {
  destructive: {
    bannerGradient:
      "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
    glow: "#EF4444",
    iconBg: "#FEE2E2",
    iconColor: "var(--destructive)",
    badgeBg: "#FEF2F2",
    badgeFg: "#991B1B",
    confirmBg: "var(--destructive)",
    Icon: AlertTriangle,
  },
  primary: {
    bannerGradient:
      "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)",
    glow: "#0A77FF",
    iconBg: "#DBEAFE",
    iconColor: "var(--primary)",
    badgeBg: "#EFF6FF",
    badgeFg: "#1E40AF",
    confirmBg: "var(--primary)",
    confirmHoverBg: "#0862D0",
    Icon: Info,
  },
  success: {
    bannerGradient:
      "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)",
    glow: "#10B981",
    iconBg: "#D1FAE5",
    iconColor: "#047857",
    badgeBg: "#ECFDF5",
    badgeFg: "#065F46",
    confirmBg: "#10B981",
    confirmHoverBg: "#059669",
    Icon: CheckCircle2,
  },
  warning: {
    bannerGradient:
      "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)",
    glow: "#F59E0B",
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    badgeBg: "#FFFBEB",
    badgeFg: "#92400E",
    confirmBg: "#F59E0B",
    confirmHoverBg: "#D97706",
    Icon: AlertTriangle,
  },
};

export function ConfirmDiscardModal({
  open,
  onOpenChange,
  variant = "destructive",
  badge,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  children,
  maxWidth = 440,
  confirmDisabled = false,
  zIndex = 14000,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Color theme — defaults to `destructive` (red). */
  variant?: Variant;
  /** Uppercase pill label at top of header. Falls back to a sensible default per variant. */
  badge?: string;
  title: string;
  description: string;
  /** Primary button label. */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Optional content (warning banner, form fields, reason input) rendered above the button stack. */
  children?: React.ReactNode;
  /** Override the default 440px max-width. Used by the Change Customer
   *  flow so the side-by-side customer comparison can breathe. */
  maxWidth?: number;
  /** When true the confirm button renders disabled (cursor, opacity)
   *  and the click handler is no-op. Used by version + revert reason
   *  flows to gate the action until the user enters a reason. */
  confirmDisabled?: boolean;
  /** Optional z-index override. Default 14000 sits above every host
   *  modal in the app (CreateQuoteModal 10000, LineItemConfigModal
   *  11000, AdjustmentFormModal 13000). Callers nesting on top of
   *  higher-z hosts (e.g. OutdatedConfigsModal at 16000) can bump
   *  this so the confirm actually renders on top. */
  zIndex?: number;
}) {
  const tokens = VARIANT_TOKENS[variant];
  const Icon = tokens.Icon;
  const resolvedBadge =
    badge ??
    (variant === "destructive"
      ? "Discard"
      : variant === "success"
        ? "Confirm"
        : variant === "warning"
          ? "Caution"
          : "Confirm");

  // Classic viewport-centering via inline styles. Inline beats shadcn's
  // class-based positioning (which can collide with tailwind-merge and isn't
  // !important). One translate is enough — pure flex/grid would require
  // wrapping the primitive, which is more invasive.
  const positioningStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    translate: "none",
    transform: "translate(-50%, -50%)",
    margin: 0,
    width: "calc(100% - 2rem)",
    height: "auto",
    maxWidth,
    maxHeight: "calc(100dvh - 2rem)",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
    /* Sit above every host modal in the app: CreateQuoteModal (10000),
       LineItemConfigModal (11000), AdjustmentFormModal (13000). The
       default 14000 keeps this above the highest common host so the
       discard prompt is actually visible when triggered. Callers can
       override via the `zIndex` prop for higher-z hosts. */
    zIndex,
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        overlayClassName="z-[13999]"
        overlayStyle={{ zIndex: zIndex - 1 }}
        style={positioningStyle}
        onInteractOutside={() => onOpenChange(false)}
      >
        {/* Colored glow header */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: tokens.bannerGradient }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: tokens.glow }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: tokens.iconBg }}
          >
            <Icon className="w-8 h-8" style={{ color: tokens.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: tokens.badgeBg,
              color: tokens.badgeFg,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {resolvedBadge}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "var(--foreground)" }}
            >
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 mx-auto"
            style={{ color: "var(--muted-foreground)", lineHeight: "1.65", maxWidth: Math.max(320, maxWidth - 120) }}
          >
            {description}
          </AlertDialogDescription>

          {children && <div className="w-full mt-5 text-left">{children}</div>}

          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={confirmDisabled ? undefined : onConfirm}
              disabled={confirmDisabled}
              className="w-full h-11 text-[14px] rounded-xl border-0 transition-all"
              style={{
                fontWeight: 600,
                backgroundColor: tokens.confirmBg,
                color: "#FFFFFF",
                opacity: confirmDisabled ? 0.5 : 1,
                cursor: confirmDisabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (confirmDisabled) return;
                if (tokens.confirmHoverBg) e.currentTarget.style.backgroundColor = tokens.confirmHoverBg;
              }}
              onMouseLeave={(e) => {
                if (confirmDisabled) return;
                e.currentTarget.style.backgroundColor = tokens.confirmBg;
              }}
            >
              {confirmLabel}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{
                fontWeight: 500,
                backgroundColor: "var(--muted)",
                color: "#334155",
              }}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Backward-compatible alias for the more semantic name. */
export { ConfirmDiscardModal as ConfirmModal };
