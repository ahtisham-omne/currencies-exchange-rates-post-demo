/* ═══════════════════════════════════════════════════════════════
   PLANNER SCOPE QUESTIONNAIRE — first-run scope picker
   ───────────────────────────────────────────────────────────────
   The compact card the buyer sees on every entry to the Procurement
   Planning tab. It asks four scope questions, then loads the matching
   demand:

     1. Planning window  (single-select)
     2. Demand sources   (multi, empty = all)
     3. Categories       (multi, empty = all)
     4. Severity         (multi, empty = all)

   Confirming (or dismissing) commits the scope and reveals the table;
   from then on the buyer refines via PlannerScopeBar.

   DESIGN: mirrors the partner-listing Filters modal (POFiltersModal)
   one-for-one — 640px flex-column card, centered header with the
   close affordance on the left, a scrollable body of titled Sections
   divided by hairlines, rounded-full pill chips that fill with the
   primary tint when selected, and a Reset / Apply footer carrying a
   "N filters selected" hint. Same tokens, same spacing, same chrome.
   ═══════════════════════════════════════════════════════════════ */

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { X, Check, CalendarDays, ChevronDown, SlidersHorizontal, Users, Search } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { DateRange } from "react-day-picker";
import { FONT } from "./designTokens";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Dialog, DialogOverlay, DialogPortal } from "./ui/dialog";
import { PlannerManageCategoriesModal, OWNED_CATEGORY_CODES } from "./PlannerManageCategoriesModal";
import {
  DEFAULT_PARAMS,
  bandLabel,
  LEVEL_BANDS_BY_SEVERITY,
  paramsEqual,
  type LevelBand,
  type ProcurementPlanningParams,
} from "./procurementPlanningParams";
import {
  BAND_TONE,
  HORIZON_OPTIONS,
  SOURCE_META,
  toggleValue,
  type DemandSourceKind,
} from "./PlannerScopeBar";

/* ─────────────────────────── TYPOGRAPHY ───────────────────────────
   CSS-var bound, Inter only — copied from POFiltersModal so the two
   filter surfaces render identical type. */
const t = {
  modalTitle: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)",
    lineHeight: "28px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)",
    lineHeight: "20px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as CSSProperties,
  sectionSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "18px",
    fontFamily: FONT,
    color: "hsl(var(--muted-foreground))",
  } as CSSProperties,
  pill: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "18px",
    fontFamily: FONT,
  } as CSSProperties,
  pillCount: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "14px",
    fontFamily: FONT,
  } as CSSProperties,
  footerBtn: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "20px",
    fontFamily: FONT,
  } as CSSProperties,
  miniLabel: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "18px",
    fontFamily: FONT,
    color: "hsl(var(--foreground))",
  } as CSSProperties,
};

/* Acquisition methods — the only two values an item carries (a primary,
   optionally a secondary). Empty selection = both included. */
const ACQUISITION_METHODS = ["Purchased", "Manufactured"] as const;

/* Owner avatar helpers — Partners parity (PocPillComponents). Deterministic
   tint from the name string so the same person always gets the same colour,
   and initials collapse to at most two characters. */
const OWNER_AVATAR_TINTS: Array<{ bg: string; text: string }> = [
  { bg: "#EFF6FF", text: "#1D4ED8" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFDF5", text: "#059669" },
  { bg: "#FEF5E7", text: "#B45309" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#F0F9FF", text: "#0284C7" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#EEF2FF", text: "#4F46E5" },
];
function ownerAvatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return OWNER_AVATAR_TINTS[Math.abs(h) % OWNER_AVATAR_TINTS.length];
}
function ownerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─────────────────────────── SECTION ───────────────────────────
   Titled group. In the modal, sections stack vertically divided by a
   hairline (POFiltersModal parity). In the inline FTU surface they render
   as self-contained bordered cards inside a horizontal grid so every
   filter is one click away — the buyer can scan and act without scrolling
   through stacked sections. */
function Section({
  title,
  subtitle,
  children,
  noBorder,
  asCard = false,
  cardClassName = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  noBorder?: boolean;
  /** Card layout for the inline FTU grid. */
  asCard?: boolean;
  /** Extra classes applied to the card wrapper — used to grow a section
      across grid columns (e.g. Owner & acquisition spans 2). */
  cardClassName?: string;
}) {
  if (asCard) {
    return (
      <div className={`rounded-[var(--radius)] border border-border bg-card p-4 flex flex-col min-w-0 ${cardClassName}`}>
        <div className="mb-3">
          <div style={t.sectionTitle}>{title}</div>
          {subtitle && <div className="mt-0.5" style={t.sectionSub}>{subtitle}</div>}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div
      className="py-5"
      style={{
        borderBottom: noBorder ? "none" : "1px solid hsl(var(--border))",
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      <div className="mb-3">
        <div style={t.sectionTitle}>{title}</div>
        {subtitle && <div className="mt-0.5" style={t.sectionSub}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────── PILL ───────────────────────────
   Rounded pill chip — selected = primary-tint fill + primary border.
   Optional 7px dot (severity bands) + optional faceted count. Exact
   StatusPill from POFiltersModal. */
function ScopePill({
  label,
  selected,
  onClick,
  count,
  dotColor,
  title,
  included,
  defaultTag,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
  dotColor?: string;
  title?: string;
  /** Subtle "on by default" state — e.g. sources when none is explicitly
      picked (empty = all included). Reads as active (tint + check) but with
      a dashed border, distinct from an explicit solid-fill selection. */
  included?: boolean;
  /** Appends a small "Default" chip — marks the preset that's pre-selected. */
  defaultTag?: boolean;
}) {
  const active = selected || included;
  const bg = active ? "hsl(var(--primary-tint))" : "hsl(var(--card))";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border transition-all cursor-pointer"
      style={{
        ...t.pill,
        backgroundColor: bg,
        borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
        borderStyle: included && !selected ? "dashed" : "solid",
        color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = bg;
      }}
    >
      {dotColor ? (
        <span className="size-[7px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      ) : (
        active && <Check className="size-3.5 shrink-0" />
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            ...t.pillCount,
            color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          }}
        >
          {count}
        </span>
      )}
      {defaultTag && (
        <span
          className="ml-0.5 inline-flex items-center rounded-full px-1.5"
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            lineHeight: "16px",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          Default
        </span>
      )}
    </button>
  );
}

/* ─── Custom planning-window date helpers ─── */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysFromTodayTo(iso: string): number {
  const today = new Date(`${todayISO()}T00:00:00`);
  const to = new Date(`${iso}T00:00:00`);
  return Math.max(1, Math.round((to.getTime() - today.getTime()) / 86400000));
}
/* Local Date ⇄ ISO (parts-based, to dodge timezone drift in the
   react-day-picker matchers — same approach as the graph's picker). */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmtMonthDay = (dt: Date) => dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const fmtFullDate = (dt: Date) => dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/* ─── Toggle switch — track + knob, primary tint when on ─── */
function ScopeToggle({
  on,
  onClick,
  label,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  sub?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left cursor-pointer"
    >
      <span
        className="relative inline-flex shrink-0 h-[20px] w-[34px] rounded-full transition-colors"
        style={{ backgroundColor: on ? "hsl(var(--primary))" : "hsl(var(--border))" }}
      >
        <span
          className="absolute top-[2px] size-[16px] rounded-full bg-white transition-all"
          style={{ left: on ? "16px" : "2px", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
        />
      </span>
      <span className="min-w-0">
        <span className="block" style={{ ...t.pill, color: "hsl(var(--foreground))", fontWeight: "var(--font-weight-medium)" }}>{label}</span>
        {sub && <span className="block mt-0.5" style={t.sectionSub}>{sub}</span>}
      </span>
    </button>
  );
}

/* ─── Categories "Configure" control ───
   One Configure button that opens the picker; the status line reads
   "All categories are included" until some are added, then "N categories
   added". Reopen any time to reconfigure. Category is the only
   browse-and-add scope dimension (items are not scoped here). */
function ConfigureRow({
  count,
  onOpen,
  onClear,
}: {
  count: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0" style={t.sectionSub}>
        {count === 0
          ? "All categories included."
          : `${count} ${count === 1 ? "category" : "categories"} added`}
      </span>
      <span className="flex items-center gap-2.5 shrink-0">
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer"
            style={{ ...t.pill, color: "hsl(var(--muted-foreground))", background: "none", border: 0, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          title="Choose which categories to plan"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius)] border cursor-pointer transition-colors hover:bg-[hsl(var(--primary-tint))] shrink-0"
          style={{ ...t.pill, fontWeight: 500, backgroundColor: count > 0 ? "hsl(var(--primary-tint))" : "hsl(var(--card))", borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}
        >
          <SlidersHorizontal className="size-3.5" />
          {count === 0 ? "Add categories" : "Manage Categories"}
        </button>
      </span>
    </div>
  );
}

export function PlannerScopeQuestionnaire({
  open,
  initial,
  categoriesList,
  categoryCodes,
  myOwnerName,
  sourceCounts,
  categoryCounts,
  bandCounts,
  ownerOptions,
  acquisitionCounts,
  onApply,
  variant = "modal",
  totalItemsCount,
  computeMatchingCount,
}: {
  open: boolean;
  initial: ProcurementPlanningParams;
  categoriesList: string[];
  /** Display code per category name (C-2131, …); falls back to the name. */
  categoryCodes?: Record<string, string>;
  /** Display name of the current buyer (for the "mine" lens label). */
  myOwnerName: string | null;
  sourceCounts: Record<DemandSourceKind, number>;
  categoryCounts: Record<string, number>;
  bandCounts: Record<LevelBand, number>;
  /** Purchasing-owner picker options — name, "You" flag, faceted count. */
  ownerOptions: { value: string; label: string; count: number; isMe: boolean }[];
  /** Faceted counts per acquisition method (Purchased / Manufactured). */
  acquisitionCounts: Record<string, number>;
  /** Commit the chosen scope and reveal the table. Called once. */
  onApply: (next: ProcurementPlanningParams) => void;
  /** Layout: "modal" (default) renders inside a Radix Dialog. "inline"
      renders the same header/body/footer directly in the page so it can
      serve as the first-time-user landing surface. */
  variant?: "modal" | "inline";
  /** Total item count in the demand universe — the denominator for the
      progress indicator. Inline surface only. */
  totalItemsCount?: number;
  /** Preview callback — returns the item count that would appear if the
      given draft were committed. Drives the header count + progress bar
      in the inline FTU surface. */
  computeMatchingCount?: (draft: ProcurementPlanningParams) => number;
}) {
  /* Draft seeds from the active scope so the buyer sees their current
     filters pre-filled. The modal is now reopenable (toolbar "Filters"
     button), not just first-run, so we re-seed on each open — see the
     effect below. */
  const [draft, setDraft] = useState<ProcurementPlanningParams>(initial);

  /* Single-commit guard. Confirming flips the parent's open flag to
     false, which makes Radix echo onOpenChange(false); without this
     guard that echo would re-apply `draft` a second time. First commit
     wins; subsequent calls are no-ops. */
  const committed = useRef(false);
  const commit = (next: ProcurementPlanningParams) => {
    if (committed.current) return;
    committed.current = true;
    onApply(next);
  };

  /* Planning-window touch flag — planning must always carry a horizon
     (the projection needs one), but we don't want to pre-select any pill
     visually. `windowTouched` flips true as soon as the buyer picks a
     preset or the Custom range, and it gates the primary CTA (a horizon
     must be explicitly acknowledged before Show my demand fires). */
  const [windowTouched, setWindowTouched] = useState(false);

  /* Reset on (re)open. The component stays mounted across opens (only the
     `open` prop toggles), so without this the single-commit guard would
     stay `true` after the first apply and a reopened modal could never
     apply or close again. On each open we clear the guard and re-seed the
     draft from the now-current scope. Depends on `open` only — re-seeding
     on `initial` changes mid-edit would wipe in-progress picks. */
  useEffect(() => {
    if (open) {
      committed.current = false;
      setDraft(initial);
      setWindowTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDefault = paramsEqual(draft, DEFAULT_PARAMS);

  /* Custom window active when an end date is set. */
  const isCustom = !!draft.customEnd;
  /* Categories open the ported Manage modal (Browse / Added table). The
     panel shows just the compact Configure control; all view/edit happens
     inside the modal. */
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  /* Custom planning-window range picker — the same range Calendar the
     graph's "Custom" horizon uses. `pendingRange` holds the in-progress
     selection until Apply. */
  const [windowPickerOpen, setWindowPickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  /* Purchasing-owner picker — a searchable checklist in a popover (the
     owner list can run long, so it is a search-and-tick control, not a
     pill row). `ownerSearch` filters the visible names. */
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  /* Selectable window: today → 365 days out. Past dates are blocked —
     you can't plan in the past. */
  const todayDate = isoToDate(todayISO());
  const maxDate = isoToDate(isoPlusDays(365));

  /* Nested-picker dismiss guard. A picker (Manage Items / Categories)
     opens over this modal; opening, interacting with, OR closing it must
     never dismiss-and-commit the filter modal underneath. The open flags
     cover the open window; `guardUntil` covers the brief focus-return race
     in the moments right after a picker closes. */
  const guardUntil = useRef(0);
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : 0);
  const isPickerGuarded = () =>
    catPickerOpen || windowPickerOpen || ownerPickerOpen || nowMs() < guardUntil.current;
  const closePicker = (set: (v: boolean) => void) => (o: boolean) => {
    set(o);
    if (!o) guardUntil.current = nowMs() + 400;
  };
  /* Close the custom-window popover and arm the guard so its dismissal
     can't bubble up and close this filter modal. */
  const closeWindowPicker = () => {
    guardUntil.current = nowMs() + 400;
    setWindowPickerOpen(false);
  };

  /* Each narrowing dimension counts as one "filter", mirroring
     POFiltersModal's countAllFilters. `mineOnly` no longer counted as
     its own dimension — the toggle was retired (Eli feedback 2026-07-10);
     it now lives silently as a modal pre-selection default. */
  const selectedCount =
    (isCustom || draft.horizonDays !== DEFAULT_PARAMS.horizonDays ? 1 : 0) +
    (draft.sources.length > 0 ? 1 : 0) +
    (draft.categories.length > 0 ? 1 : 0) +
    (draft.items.length > 0 ? 1 : 0) +
    (draft.purchasingOwners.length > 0 ? 1 : 0) +
    (draft.acquisitionMethods.length > 0 ? 1 : 0) +
    (draft.bands.length > 0 ? 1 : 0);

  /* Owner picker derived view — names filtered by the search box, plus a
     compact label for the trigger ("All owners" / a single name / "N
     owners"). Selecting just my own name reads as "{me} (You)". */
  const filteredOwners = ownerOptions.filter((o) =>
    o.label.toLowerCase().includes(ownerSearch.trim().toLowerCase()),
  );
  const ownerTriggerLabel = (() => {
    const sel = draft.purchasingOwners;
    if (sel.length === 0) return "All owners";
    if (sel.length >= ownerOptions.length && ownerOptions.length > 0) return "All owners";
    if (sel.length === 1) {
      const o = ownerOptions.find((x) => x.value === sel[0]);
      return o ? (o.isMe ? `${o.label} (You)` : o.label) : sel[0];
    }
    const meSelected = sel.some((v) => ownerOptions.find((o) => o.value === v && o.isMe));
    return meSelected ? `You + ${sel.length - 1} others` : `${sel.length} selected`;
  })();
  /* Close the owner popover and arm the dismiss guard so its closing can't
     bubble up and commit the filter modal underneath (same idiom as the
     custom-window popover). */
  const closeOwnerPicker = () => {
    guardUntil.current = nowMs() + 400;
    setOwnerPickerOpen(false);
    setOwnerSearch("");
  };

  /* Live preview count — items that would land in the listing if `draft`
     was committed right now. This IS the header's right-side content:
     the progress bar + "N of 6 filters applied" fraction used to sit here
     but read as "you must fill all six." The count reframes the same
     info as an outcome ("here's what your filters produce") rather than
     a checklist. Filters are additive: any one is enough. */
  const matchingCount = computeMatchingCount ? computeMatchingCount(draft) : undefined;
  const totalCount = totalItemsCount ?? 0;
  const isNarrowed =
    matchingCount != null && matchingCount !== totalCount;
  /* Mini fill indicator alongside the count — width = matching / total, so
     the bar visually shrinks as the buyer narrows. Small (80×3px) by
     intent: it's a "you're filtering from the total" cue, not a checklist
     of unfilled steps like the retired progress bar was. */
  const matchingPct =
    matchingCount != null && totalCount > 0
      ? Math.max(3, Math.round((matchingCount / totalCount) * 100))
      : 100;

  /* Header — the close button + Radix Title/Description are modal-only.
     Inline uses a larger left-aligned title so it feels like a page header,
     with a live count on the right that mirrors the applied filters. */
  const headerJsx = variant === "inline" ? (
    <div className="shrink-0 w-full 2xl:max-w-[1200px] 2xl:mx-auto px-6 pt-6 pb-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 style={{ ...t.modalTitle, fontSize: "var(--text-h3, 22px)", lineHeight: "30px" }}>
            Plan Inventory
          </h2>
          <p className="mt-1" style={t.sectionSub}>
            Set filters to see which items need ordering.
          </p>
        </div>
        {matchingCount != null && (
          <div
            className="shrink-0 flex flex-col items-end gap-1.5"
            style={{ fontFamily: FONT }}
          >
            <div
              className="text-[13px]"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <span
                style={{
                  color: "hsl(var(--foreground))",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {matchingCount.toLocaleString()}
              </span>
              {isNarrowed ? (
                <>
                  {" of "}
                  <span style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>
                    {totalCount.toLocaleString()}
                  </span>
                  {" items match your filters"}
                </>
              ) : (
                <>{" items ready to filter"}</>
              )}
            </div>
            <div
              className="h-[3px] rounded-full overflow-hidden"
              style={{
                backgroundColor: "hsl(var(--muted))",
                width: 160,
              }}
              role="progressbar"
              aria-valuenow={matchingPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={
                isNarrowed
                  ? `${matchingCount} of ${totalCount} items match`
                  : `Showing all ${totalCount} items`
              }
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${matchingPct}%`,
                  backgroundColor: isNarrowed
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground) / 0.35)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
      <DialogPrimitive.Close
        className="flex items-center justify-center size-8 shrink-0 rounded-[var(--radius-sm)] cursor-pointer transition-colors"
        style={{ color: "hsl(var(--muted-foreground))" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        aria-label="Close"
      >
        <X className="size-5" />
      </DialogPrimitive.Close>
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <DialogPrimitive.Title style={t.modalTitle}>Plan Inventory</DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-1" style={t.sectionSub}>
          Set filters to see which items need ordering.
        </DialogPrimitive.Description>
      </div>
      {/* Spacer to balance the close button on the left */}
      <div className="size-8 shrink-0" />
    </div>
  );

  /* Panel body + footer — shared between the modal and inline shells. */
  const panelContent = (
    <>
      {headerJsx}

          {/* ── SCROLLABLE BODY ──
             In modal mode, sections stack vertically inside a scrolling
             column. In inline mode they lay out as a responsive card grid
             so every filter sits on the same fold — buyers can click any
             dimension without scrolling. */}
          <div
            className={
              variant === "inline"
                ? "w-full 2xl:max-w-[1200px] 2xl:mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 auto-rows-min gap-4 px-6 pb-4 overflow-y-auto"
                : "flex-1 overflow-y-auto"
            }
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
          >
            {/* Planning window — preset chips + a custom From/To range. Spans
                the full row in inline mode so all 5 preset pills sit on one
                line (they set the natural width the other sections align to). */}
            <Section
              asCard={variant === "inline"}
              cardClassName="md:col-span-2 xl:col-span-6"
              title="Planning window"
              subtitle="Apply any filter to plan ahead and catch the items running short within a specific time window."
            >
              <div className="flex flex-wrap gap-2">
                {HORIZON_OPTIONS.map((o) => (
                  <ScopePill
                    key={o.value}
                    /* "All time" reads as a bare pill (no "Next" prefix);
                       every other option keeps the "Next 30 days" shape. */
                    label={o.label === "All time" ? "All time" : `Next ${o.label}`}
                    selected={windowTouched && !isCustom && draft.horizonDays === o.value}
                    defaultTag={o.value === DEFAULT_PARAMS.horizonDays}
                    onClick={() => {
                      setWindowTouched(true);
                      setDraft((d) => ({ ...d, horizonDays: o.value, customStart: undefined, customEnd: undefined }));
                    }}
                  />
                ))}
                {/* Custom — opens the same range Calendar the graph's
                    horizon picker uses. Past dates are disabled (can't plan
                    in the past); selectable today → 365 days out. */}
                <Popover
                  open={windowPickerOpen}
                  onOpenChange={(o) => {
                    if (o) {
                      setPendingRange({
                        from: draft.customStart ? isoToDate(draft.customStart) : todayDate,
                        to: draft.customEnd ? isoToDate(draft.customEnd) : isoToDate(isoPlusDays(draft.horizonDays)),
                      });
                      setWindowPickerOpen(true);
                    } else {
                      closeWindowPicker();
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={isCustom}
                      title="Plan across a custom date range"
                      className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border transition-all cursor-pointer"
                      style={{
                        ...t.pill,
                        backgroundColor: isCustom ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
                        borderColor: isCustom ? "hsl(var(--primary))" : "hsl(var(--border))",
                        color: isCustom ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                      }}
                    >
                      <CalendarDays className="size-3.5" />
                      {isCustom && draft.customEnd
                        ? `${fmtMonthDay(isoToDate(draft.customStart ?? todayISO()))} – ${fmtFullDate(isoToDate(draft.customEnd))}`
                        : "Custom"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={6} className="w-auto p-0 z-[60]">
                    <div className="border-b border-border px-3 py-2">
                      <p style={{ ...t.pill, fontWeight: 600, color: "hsl(var(--foreground))" }}>Custom date range</p>
                      <p className="mt-0.5" style={t.sectionSub}>
                        {pendingRange?.from && !pendingRange?.to
                          ? "Pick the end date"
                          : "Pick a start date, then an end date"}
                      </p>
                    </div>
                    <Calendar
                      mode="range"
                      showOutsideDays={false}
                      selected={pendingRange}
                      defaultMonth={pendingRange?.from ?? todayDate}
                      numberOfMonths={2}
                      onSelect={(range, day) => {
                        /* Click-to-deselect: re-clicking the lone selected
                           start day collapses it to a same-day range. Treat
                           that as "clear" so a single click toggles it off. */
                        if (
                          pendingRange?.from && !pendingRange?.to &&
                          range?.from && range?.to &&
                          range.from.getTime() === range.to.getTime() &&
                          range.from.getTime() === day.getTime()
                        ) {
                          setPendingRange(undefined);
                          return;
                        }
                        setPendingRange(range);
                      }}
                      disabled={[{ before: todayDate }, { after: maxDate }]}
                      initialFocus
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
                      <span className="tabular-nums" style={t.sectionSub}>
                        {pendingRange?.from && pendingRange?.to
                          ? `${fmtMonthDay(pendingRange.from)} – ${fmtFullDate(pendingRange.to)}`
                          : pendingRange?.from
                            ? `${fmtFullDate(pendingRange.from)} – …`
                            : "No range selected"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {pendingRange?.from && (
                          <button
                            type="button"
                            onClick={() => setPendingRange(undefined)}
                            className="rounded-[var(--radius-sm)] px-2.5 py-1 transition-colors hover:bg-[hsl(var(--secondary))]"
                            style={{ ...t.pill, color: "hsl(var(--muted-foreground))" }}
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={closeWindowPicker}
                          className="rounded-[var(--radius-sm)] px-2.5 py-1 transition-colors hover:bg-[hsl(var(--secondary))]"
                          style={{ ...t.pill, color: "hsl(var(--muted-foreground))" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!pendingRange?.from || !pendingRange?.to}
                          onClick={() => {
                            if (!pendingRange?.from || !pendingRange?.to) return;
                            const start = dateToISO(pendingRange.from);
                            const end = dateToISO(pendingRange.to);
                            setWindowTouched(true);
                            setDraft((d) => ({ ...d, customStart: start, customEnd: end, horizonDays: daysFromTodayTo(end) }));
                            closeWindowPicker();
                          }}
                          className="rounded-[var(--radius-sm)] px-2.5 py-1 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ ...t.pill, fontWeight: 600, backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Section>

            {/* Demand sources — multi. Empty = both included (the default);
                in that state both pills render in the dashed "included by
                default" style so the active default stays visible (#1). */}
            <Section
              asCard={variant === "inline"}
              cardClassName="xl:col-span-2"
              title="Sources"
              subtitle="All sources are included by default. Select one to focus the list."
            >
              <div className="flex flex-wrap gap-2">
                {SOURCE_META.map(({ value, label, explain }) => (
                  <ScopePill
                    key={value}
                    label={label}
                    title={explain}
                    count={sourceCounts[value] ?? 0}
                    selected={draft.sources.includes(value)}
                    onClick={() => setDraft((d) => ({ ...d, sources: toggleValue(d.sources, value) }))}
                  />
                ))}
              </div>
            </Section>

            {/* Acquisition — two pills; each is a clean, unchecked chip until
                the buyer explicitly picks one (no dashed "included by default"
                state). Row 2 middle in the FTU grid. */}
            <Section
              asCard={variant === "inline"}
              cardClassName="xl:col-span-2"
              title="Acquisition method"
              subtitle="Select whether items are purchased or manufactured."
            >
              <div className="flex flex-wrap gap-2">
                {ACQUISITION_METHODS.map((m) => (
                  <ScopePill
                    key={m}
                    label={m}
                    count={acquisitionCounts[m] ?? 0}
                    selected={draft.acquisitionMethods.includes(m)}
                    onClick={() =>
                      setDraft((d) => ({ ...d, acquisitionMethods: toggleValue(d.acquisitionMethods, m) }))
                    }
                  />
                ))}
              </div>
            </Section>

            {/* Issues — multi, color-coded dots. Row 2 right in the FTU grid. */}
            <Section
              asCard={variant === "inline"}
              cardClassName="xl:col-span-2"
              title="Issues"
              subtitle="How far an item has fallen below its maximum, minimum, or zero."
            >
              <div className="flex flex-wrap gap-2">
                {LEVEL_BANDS_BY_SEVERITY.map((b) => (
                  <ScopePill
                    key={b}
                    label={bandLabel(b)}
                    count={bandCounts[b] ?? 0}
                    dotColor={BAND_TONE[b].dot}
                    selected={draft.bands.includes(b)}
                    onClick={() => setDraft((d) => ({ ...d, bands: toggleValue(d.bands, b) }))}
                  />
                ))}
              </div>
            </Section>

            {/* Categories — modal-driven configure control. Buyer feedback
                (2026-07-10, Eli): the "Start with categories I own" toggle
                was conceptually broken — a toggle is on/off, but this was a
                DEFAULTING shortcut with ambiguous behaviour when the user
                unchecked owned categories after enabling it. Replaced with
                a static helper line + Manage Categories button. Owned
                categories are still pre-selected on first open (via
                DEFAULT_PARAMS.mineOnly = true); the modal supports
                checkboxes with a partial/minus state so removing some owned
                categories no longer creates the "is the toggle still on?"
                confusion. */}
            <Section
              asCard={variant === "inline"}
              cardClassName="md:col-span-1 xl:col-span-3"
              title="Categories"
              subtitle="We've pre-selected the categories you own — you can configure them here."
            >
              <ConfigureRow
                count={draft.categories.length}
                onOpen={() => setCatPickerOpen(true)}
                onClear={() => setDraft((d) => ({ ...d, categories: [] }))}
              />
            </Section>

            {/* Purchasing owner — searchable multi-select popover.
                Buyer feedback (2026-07-10): pill grid doesn't scale past
                2-3 owners; anything that can grow needs a searchable field.
                Copy simplified to "Filter by purchasing owner." per Eli.
                Default selection = current user (already applied by
                DEFAULT_PARAMS); once the user makes an explicit selection
                it persists via the same draft-commit path everything else
                in this modal uses (localStorage-backed scope params).
                noBorder because it's the last section in modal stacking
                order (avoids the double border with the footer). */}
            <Section
              asCard={variant === "inline"}
              cardClassName="md:col-span-1 xl:col-span-3"
              title="Purchasing owner"
              subtitle="Show items for selected owners."
              noBorder
            >
              {ownerOptions.length === 0 ? (
                <div style={t.sectionSub}>No owners available</div>
              ) : (
                /* Selected owners render inline as removable avatar chips
                   (each has an × to drop that owner). The "+ Add owner"
                   button opens a searchable popover to add more; the same
                   popover doubles as a remove path (clicking a checked
                   owner un-checks it). Buyer feedback (2026-07-10): a
                   trigger like "6 selected" gave no sense of who was
                   included; naming everyone with a chip does. */
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* "Add owner" pill is now the FIRST child so the buyer
                      always sees the add affordance at the start of the row,
                      with selected-owner chips flowing to the right of it.
                      Buyer feedback (2026-07-10). */}
                  <Popover
                    open={ownerPickerOpen}
                    onOpenChange={closePicker(setOwnerPickerOpen)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 rounded-full border border-dashed border-border bg-card px-3 transition-colors cursor-pointer hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span
                          className="truncate"
                          style={{ ...t.pill, color: "hsl(var(--foreground))" }}
                        >
                          {draft.purchasingOwners.length === 0 ? "Select owner" : "Add owner"}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-[320px] p-0"
                  >
                    {/* Header — matches the POFilterBar MultiSelectChip
                        recipe: icon + label on the left, Clear on the
                        right (only when there's a selection). */}
                    <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span
                          className="text-[12.5px] text-foreground"
                          style={{ fontWeight: 600, fontFamily: FONT }}
                        >
                          Purchasing owner
                        </span>
                      </span>
                      {draft.purchasingOwners.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, purchasingOwners: [] }))
                          }
                          className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {/* Search — appears when the pool is meaningfully long. */}
                    {ownerOptions.length > 5 && (
                      <div className="border-b border-border px-3 py-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                          <input
                            type="text"
                            value={ownerSearch}
                            onChange={(e) => setOwnerSearch(e.target.value)}
                            placeholder="Search owners..."
                            className="h-7 w-full rounded-md border border-border pl-7 pr-7 text-[12px] outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20"
                            style={{
                              backgroundColor: "hsl(var(--input-background))",
                              fontFamily: FONT,
                            }}
                          />
                          {ownerSearch && (
                            <button
                              type="button"
                              onClick={() => setOwnerSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Select all / Deselect all — toggles every
                        currently-filtered row (buyer 2026-07-22).
                        Only rendered when the pool has 2+ owners so
                        the single-owner case doesn't waste a row. */}
                    {filteredOwners.length > 1 && (() => {
                      const filteredValues = filteredOwners.map((o) => o.value);
                      const selectedSet = new Set(draft.purchasingOwners);
                      const allSelected = filteredValues.every((v) => selectedSet.has(v));
                      return (
                        <div className="flex items-center justify-between border-b border-border px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDraft((d) => {
                                if (allSelected) {
                                  // Deselect just the filtered subset; preserve any owners outside the filter.
                                  return {
                                    ...d,
                                    purchasingOwners: d.purchasingOwners.filter(
                                      (v) => !filteredValues.includes(v),
                                    ),
                                  };
                                }
                                // Union of current selection + filtered values.
                                const merged = Array.from(
                                  new Set([...d.purchasingOwners, ...filteredValues]),
                                );
                                return { ...d, purchasingOwners: merged };
                              });
                            }}
                            className="text-primary hover:underline cursor-pointer"
                            style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT }}
                          >
                            {allSelected ? "Deselect all" : "Select all"}
                            {ownerSearch.trim() && ` (${filteredOwners.length})`}
                          </button>
                          <span
                            className="text-muted-foreground tabular-nums"
                            style={{ fontSize: 10.5, fontWeight: 500, fontFamily: FONT }}
                          >
                            {draft.purchasingOwners.length}/{ownerOptions.length} selected
                          </span>
                        </div>
                      );
                    })()}
                    {/* Options — scrolls when the pool is long; each row is a
                        checkbox + avatar + name + count + "You" tag for me. */}
                    <div className="max-h-[260px] overflow-y-auto py-1">
                      {filteredOwners.length === 0 ? (
                        <div
                          className="px-3 py-4 text-center text-[12px] text-muted-foreground"
                          style={{ fontFamily: FONT }}
                        >
                          No owners match "{ownerSearch}"
                        </div>
                      ) : (
                        filteredOwners.map((o) => {
                          const selected = draft.purchasingOwners.includes(o.value);
                          const tint = ownerAvatarTint(o.label);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  purchasingOwners: toggleValue(d.purchasingOwners, o.value),
                                }))
                              }
                              className="flex w-full items-center gap-2 px-2 py-1.5 mx-1 rounded-md transition-colors cursor-pointer hover:bg-secondary/60"
                            >
                              <span
                                className={`inline-flex items-center justify-center h-4 w-4 rounded border shrink-0 ${
                                  selected
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground/40"
                                }`}
                              >
                                {selected && (
                                  <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                                )}
                              </span>
                              <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] shrink-0"
                                style={{ backgroundColor: tint.bg, color: tint.text, fontWeight: 700 }}
                              >
                                {ownerInitials(o.label)}
                              </span>
                              <span
                                className="truncate flex-1 text-left text-[12.5px]"
                                style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}
                              >
                                {o.label}
                              </span>
                              {o.isMe && (
                                <span
                                  className="inline-flex items-center rounded-full px-1.5 shrink-0"
                                  style={{
                                    fontSize: "9.5px",
                                    fontWeight: 700,
                                    lineHeight: "16px",
                                    letterSpacing: "0.03em",
                                    textTransform: "uppercase",
                                    backgroundColor: "hsl(var(--primary-tint))",
                                    color: "hsl(var(--primary))",
                                  }}
                                >
                                  You
                                </span>
                              )}
                              <span
                                className="text-[10.5px] text-muted-foreground tabular-nums shrink-0"
                                style={{ fontFamily: FONT }}
                              >
                                {o.count}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Selected-owner chips flow AFTER the add pill so the
                    add affordance stays at the start of the row. */}
                {draft.purchasingOwners.length > 0 &&
                  draft.purchasingOwners.map((val) => {
                    const o = ownerOptions.find((x) => x.value === val);
                    if (!o) return null;
                    const tint = ownerAvatarTint(o.label);
                    return (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1.5 h-8 pl-1 pr-1 rounded-full border transition-colors"
                        style={{
                          ...t.pill,
                          backgroundColor: "hsl(var(--primary-tint))",
                          borderColor: "hsl(var(--primary))",
                          color: "hsl(var(--primary))",
                        }}
                      >
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] shrink-0"
                          style={{ backgroundColor: tint.bg, color: tint.text, fontWeight: 700 }}
                        >
                          {ownerInitials(o.label)}
                        </span>
                        <span className="truncate max-w-[160px]">{o.label}</span>
                        {o.isMe && (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 shrink-0"
                            style={{
                              fontSize: "9.5px",
                              fontWeight: 700,
                              lineHeight: "16px",
                              letterSpacing: "0.03em",
                              textTransform: "uppercase",
                              backgroundColor: "hsl(var(--primary))",
                              color: "hsl(var(--primary-foreground))",
                            }}
                          >
                            You
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              purchasingOwners: d.purchasingOwners.filter((v) => v !== val),
                            }))
                          }
                          aria-label={`Remove ${o.label}`}
                          title={`Remove ${o.label}`}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 cursor-pointer transition-colors hover:bg-primary/20"
                        >
                          <X className="h-3 w-3" style={{ color: "hsl(var(--primary))" }} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* ── FOOTER ── */}
          <div
            className={`shrink-0 w-full ${variant === "inline" ? "2xl:max-w-[1200px] 2xl:mx-auto" : ""} flex items-center justify-between py-4 ${variant === "inline" ? "" : "border-t border-border"}`}
            style={{ backgroundColor: variant === "inline" ? "transparent" : "hsl(var(--card))", paddingLeft: variant === "inline" ? "24px" : "20px", paddingRight: variant === "inline" ? "24px" : "20px" }}
          >
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-5 rounded-[var(--radius)]"
              style={t.footerBtn}
              onClick={() => {
                setDraft(DEFAULT_PARAMS);
                setWindowTouched(false);
              }}
              disabled={isDefault && !windowTouched}
            >
              Reset
            </Button>

            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <span
                  style={{
                    ...t.footerBtn,
                    color: "hsl(var(--muted-foreground))",
                    fontSize: "var(--text-label)",
                  }}
                >
                  {selectedCount} {selectedCount === 1 ? "filter" : "filters"} selected
                </span>
              )}
              <Button
                className="h-9 px-5 rounded-[var(--radius)]"
                style={{
                  ...t.footerBtn,
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
                onClick={() => commit(draft)}
              >
                Show demand
              </Button>
            </div>
          </div>
    </>
  );

  /* Categories — the ported Manage modal, fed with the Categories
      listing data. Selection is by category code. Mounted alongside
      both shells so the "Configure" popover in the body works the
      same way in modal and inline surfaces. */
  const categoriesModal = (
    <PlannerManageCategoriesModal
      open={catPickerOpen}
      onOpenChange={closePicker(setCatPickerOpen)}
      selectedCodes={draft.categories}
      onChange={(codes) => setDraft((d) => ({ ...d, categories: codes }))}
      mineOnly={draft.mineOnly}
      codeByName={categoryCodes}
    />
  );

  if (variant === "inline") {
    /* Inline shell — the FTU surface lives directly on the page (no boxed
       card, no border). Filters spread across the full available width and
       every dimension sits on the same fold on 2K/4K screens. `open` is
       expected to stay true while mounted. */
    if (!open) return categoriesModal;
    return (
      <>
        <div className="w-full flex-1 flex flex-col min-h-0" style={{ fontFamily: FONT }}>
          {panelContent}
        </div>
        {categoriesModal}
      </>
    );
  }

  return (
    <>
      <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (isPickerGuarded()) return;
          commit(draft);
        }
      }}
    >
      <DialogPortal>
        {/* Focused-entry backdrop: the table behind is blurred (not just
            dimmed) so opening the planner reads as entering a focus mode
            rather than a modal floating over a live table. Reuses the app's
            glassmorphism idiom (TransitionOverlay / Partners blur layers);
            the base bg-black/50 + overlay-enter fade carry it in smoothly. */}
        <DialogOverlay style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
        <DialogPrimitive.Content
          className="bg-card fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[640px] max-h-[85vh] rounded-[var(--radius-lg)] border border-border duration-200 data-[state=open]:animate-modal-enter data-[state=closed]:animate-modal-exit [transform-origin:center_center]"
          style={{ boxShadow: "var(--elevation-lg)", fontFamily: FONT }}
          /* While a nested picker (Manage Items / categories) is open,
             interacting with or Escaping out of it must NOT dismiss —
             and thus commit — this filter modal underneath. */
          onInteractOutside={(e) => { if (isPickerGuarded()) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isPickerGuarded()) e.preventDefault(); }}
        >
          {panelContent}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>

      {categoriesModal}
    </>
  );
}
