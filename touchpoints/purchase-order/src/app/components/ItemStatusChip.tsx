import React from "react";
import { Info, CalendarDays } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { getAvatarTint } from "./avatarTints";
import { FONT } from "./designTokens";

/**
 * Item-master record status chip (Active / Inactive) — one component for
 * every PO surface that shows it: the item thumbnail Quick View, the PO
 * detail line items, and the Items Detail (edit) Modal header.
 *
 * Colours are Partners' item QuickView `RECORD_STATUS_COLORS`. Inactive
 * carries a trailing info icon and a hover card showing who marked it
 * inactive (avatar + name + role) and since when (date emphasised).
 */

export interface ItemInactiveInfo {
  by: string;
  role: string;
  /** ISO date (YYYY-MM-DD). */
  at: string;
}

type ChipSize = "sm" | "md";

const SIZE: Record<ChipSize, React.CSSProperties> = {
  /* Line-item row / edit-modal header — sits beside 10px chips. */
  sm: { padding: "1px 6px", fontSize: 10, lineHeight: 1.4, gap: 3 },
  /* Quick View header — Partners chip (px-2 py-0.5, 11px). */
  md: { padding: "2px 8px", fontSize: 11, lineHeight: "16px", gap: 4 },
};

const ACTIVE = { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" } as const;
const INACTIVE = { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A", icon: "#D97706" } as const;

export function formatInactiveDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Who marked the item inactive and since when. */
export function InactiveByCard({ inactive }: { inactive: ItemInactiveInfo }) {
  const tint = getAvatarTint(inactive.by);
  const initials = inactive.by.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col" style={{ fontFamily: FONT }}>
      <div className="px-3 pt-2.5 pb-2">
        <div className="text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>
          Marked inactive by
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="shrink-0 inline-flex items-center justify-center rounded-full text-[9px]"
            style={{ width: 22, height: 22, fontWeight: 600, backgroundColor: tint.bg, color: tint.fg }}
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="text-[12px] text-slate-900 truncate" style={{ fontWeight: 500, lineHeight: "16px" }}>
              {inactive.by}
            </span>
            <span className="text-[11px] text-slate-500 shrink-0" style={{ lineHeight: "16px" }}>
              {inactive.role}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-2">
        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: INACTIVE.icon }} aria-hidden />
        <span className="text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>Inactive since</span>
        <span className="text-[12px] text-slate-900 tabular-nums ml-auto" style={{ fontWeight: 600, lineHeight: "16px" }}>
          {formatInactiveDate(inactive.at)}
        </span>
      </div>
      <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 rounded-b-xl text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>
        Can't be added to new orders.
      </div>
    </div>
  );
}

export default function ItemStatusChip({
  inactive,
  size = "sm",
  showActive = true,
  tooltipZIndex,
}: {
  /** Absent = Active. */
  inactive?: ItemInactiveInfo;
  size?: ChipSize;
  /** Render the green Active chip when not inactive (default true). */
  showActive?: boolean;
  /** Lift the hover card above high z-index hosts (e.g. Quick View). */
  tooltipZIndex?: number;
}) {
  const base: React.CSSProperties = {
    ...SIZE[size],
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    borderRadius: 6,
    border: "1px solid",
    fontWeight: 600,
    fontFamily: FONT,
  };

  if (!inactive) {
    if (!showActive) return null;
    return (
      <span style={{ ...base, backgroundColor: ACTIVE.bg, color: ACTIVE.fg, borderColor: ACTIVE.border }}>
        Active
      </span>
    );
  }

  const iconPx = size === "md" ? 12 : 10;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          className="cursor-help"
          style={{ ...base, backgroundColor: INACTIVE.bg, color: INACTIVE.fg, borderColor: INACTIVE.border }}
          tabIndex={0}
          aria-label={`Inactive. Marked inactive by ${inactive.by}, ${inactive.role}, on ${formatInactiveDate(inactive.at)}`}
          onClick={(e) => e.stopPropagation()}
        >
          Inactive
          <Info style={{ width: iconPx, height: iconPx, color: INACTIVE.icon }} strokeWidth={2.25} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className="w-[232px] max-w-[232px] p-0 bg-white"
        style={tooltipZIndex ? { zIndex: tooltipZIndex } : undefined}
      >
        <InactiveByCard inactive={inactive} />
      </TooltipContent>
    </Tooltip>
  );
}
