import { Info, CalendarDays } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { getAvatarTint } from "./contactDirectory/avatarTints";
import { getItemInactive, formatInactiveDate, type ItemInactive } from "./inactiveItems";

/**
 * Item-master status pill (Active / Inactive).
 *
 * Ported from the Purchase Order module's `ItemStatusChip` (pleasant-flow-3),
 * which is one component for every surface that shows item status. Colours
 * are Partners' item QuickView `RECORD_STATUS_COLORS`. Inactive carries a
 * trailing info icon and a hover card saying who marked it inactive and
 * since when (`InactiveByCard`, below). Active is plain, no icon.
 *
 * Three variants, one per place PO draws it:
 *   row   : line-item rows, beside the Serialized chip.
 *   chip  : item preview (Quick View) header, after the Primary pill.
 *   badge : configurator / item-detail header, beside the part number.
 *
 * `size` only applies to `row`. PO's row chip is 10px because PO's other
 * row chips are 10px. Ours are 13px in the line tables and configurator,
 * so `md` matches them and the pill never reads smaller than its
 * neighbours. That scale is the one deliberate departure from PO.
 */

export const ITEM_STATUS_COLORS = {
  Active:   { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" },
  Inactive: { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A", icon: "#D97706" },
} as const;

/* `ui/tooltip` renders at z-300, below every modal these pills appear in
   (configurator 11000, alert dialog 15999). PO lifts it per host with a
   `tooltipZIndex` prop; this lifts it once, above the dialog, so the card
   is never hidden behind the surface it explains. */
const TOOLTIP_Z = 16100;

type Variant = "row" | "chip" | "badge";

interface Props {
  /** Item code to look up in the item master. */
  code?: string | null;
  /** Pass directly when the caller already holds the record. */
  inactive?: ItemInactive;
  variant?: Variant;
  /** Draw the green Active pill when the item is active (not on 10px rows). */
  showActive?: boolean;
  /** Plural used in the card's footer, e.g. "quote" -> "new quotes". */
  noun?: string;
  /** Row scale, see the note above. */
  size?: "sm" | "md";
}

/* PO's two sizes, plus our 13px row scale. */
const SCALE = {
  sm: { padding: "1px 6px", fontSize: 10, lineHeight: 1.4, gap: 3, weight: 600, icon: 10 },
  md: { padding: "2px 8px", fontSize: 11, lineHeight: "16px", gap: 4, weight: 600, icon: 12 },
  row13: { padding: "2px 8px", fontSize: 13, lineHeight: "normal", gap: 4, weight: 500, icon: 12 },
} as const;

function scaleFor(variant: Variant, size: "sm" | "md") {
  if (variant === "chip") return SCALE.md;
  if (variant === "row" && size === "md") return SCALE.row13;
  return SCALE.sm;
}

/* The shared avatar palette writes two of its colours as `hsl(var(--x))`,
   PO's token format. Our theme stores those variables as hex, which makes
   `hsl(#7C3AED)` invalid CSS, so the initials would silently lose their
   colour for anyone who hashes to those tints. Unwrap to plain `var()`. */
function cssColor(c: string) {
  return c.replace(/hsl\(var\((--[\w-]+)\)\)/, "var($1)");
}

/** Who marked the item inactive and since when. PO's `InactiveByCard`. */
export function InactiveByCard({ inactive, noun = "order" }: { inactive: ItemInactive; noun?: string }) {
  const tint = getAvatarTint(inactive.by);
  const initials = inactive.by.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2.5 pb-2">
        <div className="text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>
          Marked inactive by
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="shrink-0 inline-flex items-center justify-center rounded-full text-[9px]"
            style={{ width: 22, height: 22, fontWeight: 600, backgroundColor: cssColor(tint.bg), color: cssColor(tint.fg) }}
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
        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: ITEM_STATUS_COLORS.Inactive.icon }} aria-hidden />
        <span className="text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>Inactive since</span>
        <span className="text-[12px] text-slate-900 tabular-nums ml-auto" style={{ fontWeight: 600, lineHeight: "16px" }}>
          {formatInactiveDate(inactive.at)}
        </span>
      </div>
      <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 rounded-b-xl text-[11px] text-slate-500" style={{ lineHeight: "16px" }}>
        Can't be added to new {noun}s.
      </div>
    </div>
  );
}

export function InactiveItemPill({
  code,
  inactive: inactiveProp,
  variant = "row",
  showActive = false,
  noun = "order",
  size = "sm",
}: Props) {
  const inactive = inactiveProp ?? getItemInactive(code);
  const s = scaleFor(variant, size);
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    whiteSpace: "nowrap",
    borderRadius: 6,
    border: "1px solid",
    padding: s.padding,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    gap: s.gap,
    fontWeight: s.weight,
  };

  if (!inactive) {
    /* A 10px row pill never shows Active, so a table of healthy lines is
       not a column of green. The 13px row pill on the configurator's
       product card does, like PO's Item Detail header. */
    if (!showActive || (variant === "row" && size === "sm")) return null;
    const c = ITEM_STATUS_COLORS.Active;
    return (
      <span style={{ ...base, backgroundColor: c.bg, color: c.fg, borderColor: c.border }}>
        Active
      </span>
    );
  }

  const c = ITEM_STATUS_COLORS.Inactive;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          className="cursor-help"
          style={{ ...base, backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
          tabIndex={0}
          aria-label={`Inactive. Marked inactive by ${inactive.by}, ${inactive.role}, on ${formatInactiveDate(inactive.at)}`}
          /* The pill sits inside rows and cards that open something on
             click (the configurator, a preview). Reading the card must
             not trigger that. */
          onClick={(e) => e.stopPropagation()}
        >
          Inactive
          <Info style={{ width: s.icon, height: s.icon, color: c.icon }} strokeWidth={2.25} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className="w-[232px] max-w-[232px] p-0 bg-white"
        style={{ zIndex: TOOLTIP_Z }}
      >
        <InactiveByCard inactive={inactive} noun={noun} />
      </TooltipContent>
    </Tooltip>
  );
}

export default InactiveItemPill;
