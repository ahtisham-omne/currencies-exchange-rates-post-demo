import type { ReactNode } from "react";
import { ArchiveRestore, RefreshCw, Send, ToggleRight, Pencil } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Reusable status theming for User & Role detail page headers.

   Use `getStatusHeaderTheme(status)` to look up the gradient
   accent + primary-CTA spec for a given entity status.

   Replaces full-width status banners (archived/deactivated/
   invite-sent) with a subtle accented header gradient and a
   status-driven primary CTA. The default Edit action moves into
   the Actions dropdown when a non-default status is in effect.
   ───────────────────────────────────────────────────────────── */

export type StatusAccent = "default" | "red" | "amber" | "blue";

export interface StatusPrimaryAction {
  /** Visible CTA label, e.g. "Unarchive Role" */
  label: string;
  /** Lucide icon component */
  Icon: React.ComponentType<{ className?: string }>;
  /** Solid fill colour */
  bg: string;
  /** Hover fill colour */
  bgHover: string;
}

export interface StatusHeaderTheme {
  accent: StatusAccent;
  /** CSS `background` value applied as a subtle overlay across the header card. */
  gradient: string;
  /** Subtle accent tint for the header card border (overrides default). */
  borderColor?: string;
  /** Primary CTA spec; when null, the regular Edit CTA is used. */
  primary: StatusPrimaryAction | null;
}

/* ─── Default Edit primary action (per entity) ─── */
export const editPrimary = (entity: "user" | "role"): StatusPrimaryAction => ({
  label: entity === "user" ? "Edit User" : "Edit Role",
  Icon: Pencil,
  bg: "#007FFF",
  bgHover: "#0066D6",
});

/* ─── Status → theme map ─── */
export function getStatusHeaderTheme(
  status: string,
  entity: "user" | "role"
): StatusHeaderTheme {
  switch (status) {
    case "Archived":
      return {
        accent: "red",
        gradient:
          "linear-gradient(0deg, rgba(254,226,226,0.55) 0%, rgba(254,242,242,0.35) 35%, rgba(255,255,255,0) 70%)",
        borderColor: "#FECACA",
        primary: {
          label: entity === "user" ? "Unarchive User" : "Unarchive Role",
          Icon: ArchiveRestore,
          bg: "#DC2626",
          bgHover: "#B91C1C",
        },
      };
    case "Inactive":
      return {
        accent: "amber",
        gradient:
          "linear-gradient(0deg, rgba(254,243,199,0.6) 0%, rgba(255,251,235,0.4) 35%, rgba(255,255,255,0) 70%)",
        borderColor: "#FDE68A",
        primary: {
          label: entity === "user" ? "Reactivate User" : "Reactivate Role",
          Icon: ToggleRight,
          bg: "#D97706",
          bgHover: "#B45309",
        },
      };
    case "Invite Sent":
      return {
        accent: "blue",
        gradient:
          "linear-gradient(0deg, rgba(219,234,254,0.6) 0%, rgba(239,246,255,0.4) 35%, rgba(255,255,255,0) 70%)",
        borderColor: "#BFDBFE",
        primary: {
          label: "Resend Invitation",
          Icon: RefreshCw,
          bg: "#2563EB",
          bgHover: "#1D4ED8",
        },
      };
    case "Invite Expired":
      // Amber treatment mirrors the Deactivated (Inactive) header, same gradient
      // and border. The Resend Invite CTA reuses the amber Reactivate button colours.
      return {
        accent: "amber",
        gradient:
          "linear-gradient(0deg, rgba(254,243,199,0.6) 0%, rgba(255,251,235,0.4) 35%, rgba(255,255,255,0) 70%)",
        borderColor: "#FDE68A",
        primary: {
          label: "Resend Invitation",
          Icon: Send,
          bg: "#D97706",
          bgHover: "#B45309",
        },
      };
    default:
      return {
        accent: "default",
        gradient: "transparent",
        primary: null,
      };
  }
}

/* ─── Visual overlay applied behind the header content ─── */
export function StatusGradientOverlay({
  theme,
  rounded = 12,
}: {
  theme: StatusHeaderTheme;
  rounded?: number;
}) {
  if (theme.accent === "default") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: theme.gradient,
        borderRadius: rounded,
      }}
    />
  );
}

/* ─── Status-aware primary CTA ─── */
export function StatusPrimaryButton({
  spec,
  onClick,
  compact = false,
  children,
}: {
  spec: StatusPrimaryAction;
  onClick: () => void;
  compact?: boolean;
  children?: ReactNode;
}) {
  const { Icon, bg, bgHover, label } = spec;
  return (
    <button
      onClick={onClick}
      className={`rounded-lg text-white inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-200 ${
        compact ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"
      }`}
      style={{ fontWeight: 600, backgroundColor: bg }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bg)}
    >
      <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {children ?? label}
    </button>
  );
}
