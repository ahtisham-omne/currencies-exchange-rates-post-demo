/**
 * Shared building blocks for the procurement planner Sandbox modal —
 * headers, KPI tiles, content cards, sidebar info cards and tables.
 * (Originally also served `DemandItemDetailModal` and `PlannerCauseModal`,
 * which were retired in favour of the Sandbox as the single landing
 * surface; the kit stays here so future planner surfaces can pull from
 * the same primitives.)
 *
 * Reference for visual decisions: partner Location detail modal in
 * `Partners/src/app/pages/VendorDetailsPage.tsx` (DashInfoCard at line
 * 3780, ContentCard at 2030, KPI tile pattern at 6169, Primary Contact
 * card recipe at 6328).
 */

import React, { useState } from "react";
import { CalendarDays, ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { FONT } from "./designTokens";
import type { PlannerSeverity } from "./plannerData";

/* ─────────────────────────── PALETTES ─────────────────────────── */

/** Header wash — partner Location modal pattern. Severity drives the tint
    (the partner version uses Active/Inactive/Archived; we map severity to
    the same wash language: amber for warn, rose for danger). */
export const HEADER_WASH: Record<PlannerSeverity, { bg: string; border: string }> = {
  healthy:   { bg: "bg-white",        border: "border-[#EEF2F6]" },
  below_min: { bg: "bg-amber-50/50",  border: "border-amber-200" },
  at_zero:   { bg: "bg-rose-50/50",   border: "border-rose-200" },
  negative:  { bg: "bg-rose-50/50",   border: "border-rose-200" },
};

/** Severity status pill — same rounded-full shape the Location modal's
    Active/Inactive pill uses. */
export const SEVERITY_PILL: Record<
  PlannerSeverity,
  { bg: string; color: string; border: string; label: string }
> = {
  healthy:   { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0", label: "Healthy" },
  below_min: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "Below min" },
  at_zero:   { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA", label: "At zero" },
  negative:  { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA", label: "Negative" },
};

/* ─────────────────────────── COMPONENTS ─────────────────────────── */

/** Partner KPI card — literal copy of partner Location KPI tile markup
    (`Partners/.../VendorDetailsPage.tsx:6169–6201`). No tone/value tint,
    no hint subtext, no custom fontFamily — same shape, same classes,
    inherits global Inter. */
export function PartnerKpi({
  label,
  value,
  tooltip,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="group border rounded-lg bg-white relative min-w-0 transition-all duration-200 select-none overflow-hidden border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>
              {label}
            </p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex shrink-0" tabIndex={-1}>
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-[11px] z-[300]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <p
            className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap"
            style={{ fontWeight: 600, lineHeight: 1.2 }}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/** ContentCard (lite) — visual port of the partner ContentCard, stripped
    of the drag/resize/remove machinery. Same header bar (icon box + 13px
    semibold title + optional tooltip + meta on the right) and same
    rounded-xl bordered shell.

    `tone="sandbox"` gives the card a highlighted treatment in the
    **planner violet** (`#524BE0`) — subtle violet wash + violet border +
    faint violet ring — pairs visually with the Sandbox modal's violet
    header wash so the buyer reads both as part of the same
    planning-mode signal. Useful for calling attention to the section a
    user is meant to interact with first inside Sandbox surfaces. */
export function ContentCardLite({
  title,
  icon: Icon,
  tooltip,
  meta,
  metaTone = "default",
  tone = "default",
  pulse = false,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  tooltip?: string;
  meta?: string;
  metaTone?: "default" | "warn";
  tone?: "default" | "primary" | "sandbox";
  /** Subtle attention-grabbing pulse on the outer ring shadow — pairs
      with `tone="sandbox"` to nudge a first-time buyer toward the
      action surface. The animation lives in `index.css`
      (`@keyframes sandbox-pulse`) and is intentionally low-contrast so
      it doesn't get annoying. Stops the moment the host flips the
      prop to `false`. */
  pulse?: boolean;
  children: React.ReactNode;
}) {
  let toneClass = "border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]";
  let headerToneClass = "border-muted";
  if (tone === "primary") {
    toneClass = "border-primary/40 bg-[rgba(10,119,255,0.025)] shadow-[0_0_0_3px_rgba(10,119,255,0.06),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_3px_rgba(10,119,255,0.08),0_2px_8px_-2px_rgba(0,0,0,0.06)]";
    headerToneClass = "border-primary/15";
  } else if (tone === "sandbox") {
    // When pulsing we drop the static box-shadow so the keyframe
    // animation owns it; otherwise the static value would win the
    // cascade and the pulse would be invisible.
    toneClass = pulse
      ? "border-[#524BE0]/40 bg-[rgba(82,75,224,0.03)] sandbox-pulse"
      : "border-[#524BE0]/40 bg-[rgba(82,75,224,0.03)] shadow-[0_0_0_3px_rgba(82,75,224,0.08),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_3px_rgba(82,75,224,0.10),0_2px_8px_-2px_rgba(0,0,0,0.06)]";
    headerToneClass = "border-[#524BE0]/15";
  }
  // Icon container styling — sandbox tone uses a white pill with a
  // violet border + violet glyph so the icon reads against the
  // tinted card without picking up the default blue accent.
  const iconWrapStyle: React.CSSProperties =
    tone === "sandbox"
      ? { backgroundColor: "#FFFFFF", border: "1px solid rgba(82,75,224,0.25)" }
      : {};
  const iconWrapClass =
    tone === "sandbox" ? "" : "bg-accent";
  const iconStyle: React.CSSProperties =
    tone === "sandbox" ? { color: "#524BE0" } : {};
  const iconClass = tone === "sandbox" ? "" : "text-primary";
  return (
    <div className={`rounded-xl border overflow-hidden transition-[box-shadow,border-color] duration-300 ${toneClass}`}>
      <div className={`px-4 py-2.5 border-b ${headerToneClass} flex items-center justify-between shrink-0 select-none`}>
        <div className="flex items-center gap-2">
          {Icon && (
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconWrapClass}`}
              style={iconWrapStyle}
            >
              <Icon className={`w-3.5 h-3.5 ${iconClass}`} style={iconStyle} />
            </div>
          )}
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex" tabIndex={-1}>
                  <Info className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={6}
                className="z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
              >
                <p className="text-[11px] leading-relaxed">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {meta && (
          <span
            className="text-[11px] truncate"
            style={{
              fontWeight: 500,
              color: metaTone === "warn" ? "#d48e29" : "#94A3B8",
              maxWidth: 280,
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** DashInfoCard — 1:1 visual port of the partner Location modal's
    DashInfoCard (partner file line 3780). Rounded-xl bordered white card
    with a collapsible header (icon box + 12px semibold title + chevron). */
export function DashInfoCard({
  title,
  icon: Icon,
  tooltip: cardTooltip,
  children,
  defaultOpen = true,
  /** Optional right-aligned content rendered in the header (e.g. a
      status pill). Renders before the chevron. */
  headerRight,
}: {
  title: string;
  icon?: React.ElementType;
  tooltip?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
        style={{ borderBottom: isOpen ? "1px solid #F1F5F9" : "none" }}
        onClick={() => setIsOpen((v) => !v)}
      >
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-primary" />
          </div>
        )}
        <span className="text-[12px] text-slate-700 text-left" style={{ fontWeight: 600 }}>
          {title}
        </span>
        {cardTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[300]">
              {cardTooltip}
            </TooltipContent>
          </Tooltip>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {headerRight}
          <ChevronDown
            className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </span>
      </button>
      {isOpen && <div className="px-3.5 py-3">{children}</div>}
    </div>
  );
}

/** DashInfoLabel — 1:1 visual port of the partner DashInfoLabel (partner
    file line 3842). 10px / 500 / slate-400. */
export function DashInfoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 mb-px">
      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
        {children}
      </p>
    </div>
  );
}

/** Inline pill — used in table cells and tag chips throughout the
    procurement modals. */
export function Pill({
  text,
  fg,
  bg,
  bd,
}: {
  text: string;
  fg: string;
  bg: string;
  bd?: string;
}) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md border"
      style={{
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: bg,
        color: fg,
        borderColor: bd ?? "transparent",
      }}
    >
      {text}
    </span>
  );
}

/** Th — table header cell with the partner's small-caps, slate-500 style. */
export function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-1.5 ${align === "right" ? "text-right" : "text-left"}`}
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        color: "#64748B",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

/** LegendDot — chart legend swatch (solid or dashed). */
export function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block"
        style={{
          width: 12,
          height: 0,
          borderTop: `${dashed ? "1.5px dashed" : "2px solid"} ${color}`,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ─── Shared planner date picker ───
   Replaces `<input type="date">` across every planner surface so all date
   fields render with the design-system Calendar (react-day-picker) instead
   of the OS-native date picker. Trigger is a slim button (matches toolbar
   controls: h-8, muted border, monospace date), popover is a single-month
   Calendar with an optional `min` guard. Consumers pass an ISO date string
   (`YYYY-MM-DD`) — empty string means "unset". */
function isoToLocalDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDisplay(iso: string): string {
  const d = isoToLocalDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function SystemDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  className = "",
  disabled = false,
  align = "start",
}: {
  /** ISO `YYYY-MM-DD` string. Empty string means unset. */
  value: string;
  onChange: (iso: string) => void;
  /** Earliest selectable date (inclusive). Days before are disabled. */
  min?: Date;
  /** Latest selectable date (inclusive). Days after are disabled. */
  max?: Date;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToLocalDate(value);
  const display = formatDisplay(value);
  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex items-center gap-2 h-8 rounded-md border border-border bg-card px-2.5 text-[12px] transition-colors hover:!bg-muted/40 hover:!text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          style={{ fontFamily: FONT, color: display ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
        >
          <CalendarDays className="size-3.5 shrink-0 opacity-60" />
          <span className="tabular-nums">{display || placeholder}</span>
        </button>
      </PopoverTrigger>
      {/* z-[500] beats the wizard/graph popovers this date picker
          renders inside (`z-[300]`) so the calendar surfaces on top
          instead of being clipped. `max-w-[calc(100vw-1rem)]` +
          `max-h-[calc(100dvh-8rem)]` shrink the popover to fit small
          viewports (Radix already re-positions on collision, but
          without a size cap the calendar could still overflow when
          rendered inside another popover). `overflow-auto` lets the
          buyer scroll to weeks that would otherwise fall off the
          screen. */}
      <PopoverContent
        className="w-auto p-0 z-[500] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-8rem)] overflow-auto"
        align={align}
        sideOffset={6}
        collisionPadding={12}
      >
        <Calendar
          /* Key by value so the calendar remounts when the parent
             changes the selected date — react-day-picker's
             `defaultMonth` only applies at MOUNT time, and Radix
             Popover in some flows keeps the content mounted between
             opens (or re-uses the DOM subtree). Without the key, the
             calendar would keep showing the month the user last
             navigated to instead of returning to the selected
             month. Buyer feedback 2026-07-20: "open the date picker
             to the already-clicked date (still not doing it)." */
          key={value || "empty"}
          mode="single"
          selected={selected}
          /* Anchor the opened calendar to the selected date's month, not
             today's. Falls back to `min` (earliest selectable) when no
             value is set, then react-day-picker's own default (today). */
          defaultMonth={selected ?? min ?? undefined}
          onSelect={(d) => {
            if (d) {
              onChange(localDateToIso(d));
              setOpen(false);
            }
          }}
          disabled={[
            ...(min ? [{ before: min }] : []),
            ...(max ? [{ after: max }] : []),
          ]}
          initialFocus
          showOutsideDays={false}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Modal sizing — literal copy of partner Location modal's `modalSizeClass`
    (non-fullscreen variant, `Partners/.../VendorDetailsPage.tsx:4805`).
    The `!important` overrides defeat shadcn's default `sm:max-w-lg`. */
export const MODAL_BASE_TRANSITION =
  "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
export const MODAL_SIZE_CLASS = `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${MODAL_BASE_TRANSITION} !max-w-[100%] sm:!max-w-[min(80vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;
