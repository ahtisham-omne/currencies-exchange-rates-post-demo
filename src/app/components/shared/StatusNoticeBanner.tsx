import React from "react";
import { X } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   Partner-style status notice banner.

   Single canonical surface for "Quote Cancelled / Archived",
   "Order Cancelled / Archived", and similar inline notices that
   sit at the top of the detail body. Same chrome as Partner's
   notice rows: rounded-xl card, soft shadow, 32px tinted icon
   chip on the left, 13px title + 12px muted subtitle, optional
   action button on the right.

   Replaces the old "3-px coloured stripe + 13×13 inline icon"
   pattern so every notice matches the rest of the design system.
   ═══════════════════════════════════════════════════════════════ */

export type StatusNoticeTone =
  | "destructive"
  | "warning"
  | "info"
  | "success"
  | "neutral";

interface ToneVariant {
  iconBg: string;
  iconColor: string;
  border: string;
}

const TONE_VARIANTS: Record<StatusNoticeTone, ToneVariant> = {
  destructive: { iconBg: "rgba(220, 38, 38, 0.10)", iconColor: "#DC2626", border: "rgba(220, 38, 38, 0.18)" },
  warning:     { iconBg: "rgba(245, 158, 11, 0.12)", iconColor: "#B45309", border: "rgba(245, 158, 11, 0.22)" },
  info:        { iconBg: "rgba(27, 110, 243, 0.10)", iconColor: "#1B6EF3", border: "rgba(27, 110, 243, 0.20)" },
  success:     { iconBg: "rgba(16, 185, 129, 0.10)", iconColor: "#047857", border: "rgba(16, 185, 129, 0.20)" },
  neutral:     { iconBg: "rgba(100, 116, 139, 0.10)", iconColor: "#475569", border: "rgba(100, 116, 139, 0.20)" },
};

export interface StatusNoticeBannerProps {
  tone: StatusNoticeTone;
  Icon: React.ElementType;
  title: string;
  /** String or ReactNode — string subtitles get the ellipsis truncate
   *  chrome; ReactNode subtitles bypass truncation so callers can
   *  render inline pills / structured chunks (e.g. a "REASON" chip
   *  followed by the reason text and attribution). */
  subtitle?: React.ReactNode;
  /** Render as a tighter row on narrow viewports (drops side padding). */
  isNarrow?: boolean;
  action?: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
  };
  /** When provided, renders a small close-X on the right of the banner
   *  next to the action button. Owner controls dismiss persistence —
   *  the banner itself stays a pure UI component. */
  onDismiss?: () => void;
  className?: string;
}

export function StatusNoticeBanner({
  tone,
  Icon,
  title,
  subtitle,
  isNarrow,
  action,
  onDismiss,
  className,
}: StatusNoticeBannerProps) {
  const variant = TONE_VARIANTS[tone];
  const ActionIcon = action?.icon;

  return (
    <div
      className={`rounded-xl ${className ?? ""}`.trim()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: isNarrow ? 8 : 16,
        padding: isNarrow ? "10px 12px" : "12px 16px",
        marginBottom: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        background: "var(--card)",
        border: `1px solid ${variant.border}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        {/* Partner-style icon chip — 32px square, tinted background, no border. */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: variant.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 16, height: 16, color: variant.iconColor }} strokeWidth={2} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </span>
          {subtitle && (
            typeof subtitle === "string" ? (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.45,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: isNarrow ? "100%" : 600,
                }}
                title={subtitle}
              >
                {subtitle}
              </span>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.45,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "nowrap",
                  overflow: "hidden",
                  minWidth: 0,
                  maxWidth: isNarrow ? "100%" : 600,
                }}
              >
                {subtitle}
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: isNarrow ? "0 10px" : "0 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "#FFFFFF",
              color: "var(--foreground)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
              transition: "all 150ms",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
          >
            {ActionIcon && <ActionIcon style={{ width: 14, height: 14 }} />}
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              transition: "color 120ms, background-color 120ms",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--foreground)";
              e.currentTarget.style.backgroundColor = "var(--muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--muted-foreground)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}

export default StatusNoticeBanner;
