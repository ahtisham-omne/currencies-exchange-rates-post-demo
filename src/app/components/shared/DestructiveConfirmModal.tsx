import { useEffect } from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { ModalShell } from "./ModalShell";

type Tone = "danger" | "warning" | "success" | "brand";

interface DestructiveConfirmModalProps {
  open: boolean;
  onClose: () => void;
  /** Badge text shown above the title (e.g. "DISCARD", "DEACTIVATE") */
  badge: string;
  /** Main title question (e.g. "Discard changes?") */
  title: string;
  /** Description paragraph(s): string or rich node */
  description: React.ReactNode;
  /** Optional rich content rendered between the description and the buttons.
   *  Useful for showing a list of affected items, callouts, or other detail
   *  blocks that don't fit inside the centered description paragraph. */
  extra?: React.ReactNode;
  /** Primary destructive action button label */
  confirmLabel: string;
  /** Secondary cancel button label */
  cancelLabel?: string;
  onConfirm: () => void;
  /** Color tone: "danger" (red, default) for permanent/destructive,
   *  "warning" (amber) for reversible deactivation, "success" (green) for
   *  positive/restorative confirmations. */
  tone?: Tone;
  /** Optional header icon override (defaults to AlertTriangle). */
  icon?: LucideIcon;
  /** Optional max-width override (defaults to 400px). */
  maxWidth?: number;
  /** Caps the height of the `extra` block, scrolling it instead of growing the
   *  modal. Use when `extra` holds disclosures that can expand (see the archive
   *  confirmation's billing accordions), so the modal keeps one height whether
   *  they are open or closed. */
  extraMaxHeight?: number;
  /** Optional z-index passthrough for stacking over other modals (defaults to 70). */
  z?: number;
}

const TONE_CONFIG: Record<Tone, {
  glowBg: string;
  glowColor: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeColor: string;
  confirmBg: string;
  gradient: string;
}> = {
  danger: {
    glowBg: "#FEF2F2",
    glowColor: "#EF4444",
    iconBg: "#FEE2E2",
    iconColor: "#DC2626",
    badgeBg: "#FEF2F2",
    badgeColor: "#991B1B",
    confirmBg: "#DC2626",
    gradient:
      "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
  },
  warning: {
    glowBg: "#FFFBEB",
    glowColor: "#F59E0B",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    badgeBg: "#FEF3C7",
    badgeColor: "#92400E",
    confirmBg: "#D97706",
    gradient:
      "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)",
  },
  success: {
    glowBg: "#ECFDF5",
    glowColor: "#10B981",
    iconBg: "#D1FAE5",
    iconColor: "#059669",
    badgeBg: "#D1FAE5",
    badgeColor: "#065F46",
    confirmBg: "#059669",
    gradient:
      "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)",
  },
  brand: {
    glowBg: "#EDF4FF",
    glowColor: "#0A77FF",
    iconBg: "#EFF6FF",
    iconColor: "#0A77FF",
    badgeBg: "#EFF6FF",
    badgeColor: "#1E40AF",
    confirmBg: "#0A77FF",
    gradient:
      "linear-gradient(180deg, #EDF4FF 0%, rgba(237,244,255,0.3) 70%, transparent 100%)",
  },
};

/**
 * Centered destructive confirmation modal with colored gradient glow header,
 * AlertTriangle icon, badge, and full-width stacked buttons.
 *
 * Use for ALL destructive / negative-consequence actions across the system:
 * discard changes, deactivate, archive, disable, etc.
 */
export function DestructiveConfirmModal({
  open,
  onClose,
  badge,
  title,
  description,
  extra,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  tone = "danger",
  icon: Icon = AlertTriangle,
  maxWidth = 400,
  extraMaxHeight,
  z = 70,
}: DestructiveConfirmModalProps) {
  const cfg = TONE_CONFIG[tone];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <ModalShell open={open} onClose={onClose} z={z}>
      <div
        className="bg-white rounded-2xl w-full mx-4 overflow-hidden"
        style={{ maxWidth: `${maxWidth}px`, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)" }}
      >
        {/* Colored glow header */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: cfg.gradient }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: cfg.glowColor }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: cfg.iconBg }}
          >
            <Icon className="w-8 h-8" style={{ color: cfg.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: cfg.badgeBg,
              color: cfg.badgeColor,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {badge}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3
            className="text-[18px] tracking-[-0.02em]"
            style={{ fontWeight: 600, color: "#0F172A" }}
          >
            {title}
          </h3>
          <p
            className="text-[13px] mt-2 mx-auto"
            style={{ color: "#475569", lineHeight: "1.65", maxWidth: `${maxWidth - 100}px` }}
          >
            {description}
          </p>
          {extra && (
            <div
              className={`w-full mt-5 text-left${extraMaxHeight ? " overflow-y-auto" : ""}`}
              style={extraMaxHeight ? { maxHeight: `${extraMaxHeight}px` } : undefined}
            >
              {extra}
            </div>
          )}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: cfg.confirmBg, color: "#fff" }}
              type="button"
            >
              {confirmLabel}
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:bg-[#E2E8F0]"
              style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
              type="button"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
