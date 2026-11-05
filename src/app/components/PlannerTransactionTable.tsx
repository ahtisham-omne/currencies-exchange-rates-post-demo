import React, { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import {
  Search, X, ArrowDown, ArrowUp, Receipt, ExternalLink, CalendarDays,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, HelpCircle, CornerRightDown,
  Columns3,
} from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FONT } from "./designTokens";
import { cn } from "./ui/utils";
import { getAvatarTint } from "./avatarTints";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "./pocColumnSelector";
import {
  PlannerTxFiltersModal,
  PlannerTxFiltersTrigger,
  EMPTY_TX_FILTERS,
  countTxFilters,
  type PlannerTxFilterState,
} from "./PlannerTxFilterBar";

/* ═══════════════════════════════════════════════════════════════
   PLANNER TRANSACTION TABLE
   A standalone, presentational ledger table that mirrors the design
   of the Purchase Orders listing table (PODataTable.tsx) — same shell,
   header tokens, body-cell rhythm, frozen left columns, tri-state sort,
   toolbar, and pagination footer — but renders projected inventory
   transactions (a chronological on-hand ledger) rather than POs.

   It does NOT import or modify PODataTable / POFiltersModal — the
   visual fidelity is replicated locally. The exported types form the
   shared contract that host code (sandbox / graph) builds rows from.
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SHARED CONTRACT — exported types
   Keep names + shapes EXACT; other code imports these from this file.
   ═══════════════════════════════════════════════════════════════ */

export type TxColumnId =
  | "id"
  | "typeSource"
  | "datetime"
  | "party"
  | "plannedQty"
  | "processedQty"
  | "onHandBefore"
  | "onHandAfter"
  | "price";

export type TxBand = "healthy" | "aboveMax" | "belowMax" | "belowMin" | "belowZero";

export interface TxRowData {
  id: string;                  // raw unique id (React key / sort tiebreak; never shown)
  displayId: string;           // friendly ledger id shown in the Transaction ID column, e.g. "TX-2025-4561"
  typeLabel: string;           // e.g. "Sales Order","Purchase Request","PO","Draft PO","Planned PO","Simulated demand","Simulated supply","Planned demand"
  typeKind: "so" | "pr" | "po" | "draft" | "planned" | "simulated" | "demand";
  direction: "incoming" | "outgoing"; // incoming = Inventory Creation, outgoing = Consumption
  sourceRef: string | null;    // "SO-10428" | "PO-1234" | null
  sourceHref: string | null;   // link target if routable, else null
  date: string;                // ISO yyyy-mm-dd
  time: string;                // "HH:mm"
  daysFromToday: number;       // graph cross-highlight key
  party: string;               // Customer/Vendor name ("" if none)
  plannedQty: number;
  processedQty: number | null; // null = not applicable (forecast)
  onHandBefore: number;
  onHandAfter: number;
  band: TxBand;                // band of onHandAfter
  isMovement: boolean;
  unitPrice: number | null;
  linePrice: number | null;
  uom: string;
  isDraft: boolean;
  isSimulated: boolean;
  isPlanned: boolean;
  isPredicted: boolean;
  crossing: { label: string; tone: TxBand } | null; // a band-crossing this row CAUSES; render ABOVE this row
}

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface PlannerTransactionTableProps {
  rows: TxRowData[];
  density?: "condensed" | "comfort";
  defaultPageSize?: number;            // default 20
  highlightDay?: number | null;        // graph->table: highlight rows where daysFromToday === highlightDay
  onHoverRow?: (daysFromToday: number | null) => void; // table->graph
  hiddenColumns?: Set<TxColumnId>;
  rightSlot?: React.ReactNode;         // host injects sandbox "Simulate/Add" controls into the toolbar (row 1 right)
  /** Host-injected chips that live in the SECOND toolbar row alongside
      Direction filters + Newest/Oldest sort. E.g. the "Draft POs" toggle
      pill from UnifiedTransactionStream. Kept out of `rightSlot` so the
      row-1 right cluster stays clean (date range + primary action). */
  leftSlot?: React.ReactNode;
  /** Fires with the current minimum width in pixels required to show
      every visible column at its natural width. The parent
      (PlannerWorkspacePage) uses this to shrink the tx panel when
      the buyer hides columns so blank space doesn't remain to the
      right of the table (Eli 2026-07-30). */
  onMinWidthChange?: (minPx: number) => void;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS + PALETTES
   ═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
/* Binary sort — asc / desc only (buyer 2026-07-19: "the date is
   showing three states; it should only be two"). The clear/null
   state was removed because with a date-anchored table the buyer
   always wants SOME chronological order; letting the sort collapse
   to unordered surfaced rows in insertion order, which read as
   random noise. */
type SortDir = "asc" | "desc";

/* Type dot palette — one 6px dot per typeKind for identification.
   2026-07-13 rework: the pill used to render at full saturation
   (10% bg + full text + 20% border in the type's tone), which made
   every row scream category. Best-practice guidance (Linear /
   Notion / GitHub) treats type as a *category*, not a status, so
   the chip is now a shared neutral chrome and only the dot carries
   the identifying color. Semantic band tones (belowZero/belowMin)
   stay saturated — those DO convey urgency. */
const TYPE_TONE: Record<TxRowData["typeKind"], string> = {
  so:        "#DC2626",
  pr:        "#EA580C",
  po:        "#059669",
  draft:     "#64748B",
  planned:   "#0A77FF",
  simulated: "#7C3AED",
  demand:    "#DC2626",
};

/* On-hand band tone — shared "one colour language" with the gap graph. */
const BAND_TONE: Record<TxBand, string> = {
  belowZero: "#B91C1C",
  belowMin:  "#C2410C",
  /* Above-max = overstock (Nophil 2026-07-14). Fresh teal, distinct
     from every other band, semantically reads "capital tied up"
     rather than "shortage warning". Kept in sync with the graph's
     Above-max zone + the scope-bar Issues pill dot. */
  aboveMax:  "#0F766E",
  belowMax:  "#475569",
  healthy:   "#15803D",
};

/* Sticky shadow on the last frozen-left column (matches PODataTable). */
const STICKY_SHADOW_LEFT = "inset -1px 0 0 0 rgba(0,0,0,0.08)";

/* Header-cell background — same slate as the PO listing thead. */
const HEADER_BG = "rgb(248, 250, 252)";

/* ── Frozen-left column widths (px) ── */
const ID_W = 132;
/* Trimmed 240 → 210 (2026-07-10) → 190 → 155 (2026-07-21): "we can save
   more space from type/source column". Longest label "Draft purchase
   order" (~130px at cell font) + arrow icon (12) + gap (8) fits with a
   small buffer; the two-line reference number below uses the same
   width. */
const TYPE_SRC_W = 116;

/* ═══════════════════════════════════════════════════════════════
   COLUMN DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

interface TxColumnDef {
  id: TxColumnId;
  label: string;
  align: "left" | "right";
  sortable: boolean;
  frozen?: boolean;
  width: number;
  minWidth: number;
}

/* Trimmed set — Transaction ID, Processed qty, and Price were dropped
   (per buyer feedback 2026-07-09: table read too wide, those columns
   weren't in daily use). Row data still carries the fields so sort keys
   and search continue to work if callers ever surface them again. */
/* Default widths tightened again (buyer 2026-07-23: "we have room
   there, reduce column widths further for both smaller and larger
   screens"). Sum of defaults ≈ 578px — was 655px. The buyer can still
   drag any column wider via the resize handle; both `width` and
   `minWidth` moved so the compressed size IS the floor. */
const COLUMNS: TxColumnDef[] = [
  /* Compressed defaults tightened again (Eli 2026-07-30 revision:
     "on smaller screens we still have margin; we can compress").
     Widths dropped to their tightest legible sizes; combined with
     the padding reduction below, the tx panel floor on 1200px
     viewports drops from ~47% to ~42%. */
  { id: "datetime",     label: "Date",              align: "left",  sortable: true,  frozen: true, width: 80,         minWidth: 80 },
  { id: "typeSource",   label: "Type / Source",     align: "left",  sortable: true,                width: TYPE_SRC_W, minWidth: TYPE_SRC_W },
  { id: "party",        label: "Customer / Vendor", align: "left",  sortable: true,                width: 96,         minWidth: 88 },
  { id: "plannedQty",   label: "Planned qty",       align: "right", sortable: true,                width: 72,         minWidth: 72 },
  { id: "onHandBefore", label: "On hand (before)",  align: "right", sortable: false,               width: 72,         minWidth: 72 },
  { id: "onHandAfter",  label: "On hand (after)",   align: "right", sortable: false,               width: 72,         minWidth: 72 },
];

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS-var bound, Inter only (mirrors PODataTable `s`)
   ═══════════════════════════════════════════════════════════════ */

/* Compact type scale — pulled ~1-2px smaller than the base tokens so the
   ledger reads dense on 2K/4K where 13px cells felt oversized. Kept as hard
   px so the sizes stay stable regardless of the root font-size variable. */
const s = {
  thLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
    letterSpacing: "normal",
    textTransform: "none" as const,
  } as React.CSSProperties,
  cellId: {
    fontSize: "var(--planner-cell-fs)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "var(--planner-cell-lh)",
    fontFamily: FONT,
  } as React.CSSProperties,
  cellText: {
    fontSize: "var(--planner-cell-fs)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "var(--planner-cell-lh)",
    fontFamily: FONT,
  } as React.CSSProperties,
  uiCaption: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

/** Local-ISO yyyy-mm-dd from a Date (never toISOString() — that shifts in
    timezones ahead of UTC). Matches the planner's date-handling rule. */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Jun 30, 2026" from an ISO yyyy-mm-dd (parsed at local midnight). */
function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
  });
}

/** Currency, e.g. $1,234.00 */
function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Highlight matched substrings of `text` against `query`. */
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) { out.push(text.slice(i)); break; }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={key++} style={{ background: "#FEFCE8", color: "#854D0E", padding: 0 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return <>{out}</>;
}

/* ═══════════════════════════════════════════════════════════════
   TYPE PILL — rounded-full chip toned by typeKind
   draft = hollow (transparent bg, coloured border + text)
   ═══════════════════════════════════════════════════════════════ */

function TypePill({ row, search = "" }: { row: TxRowData; search?: string }) {
  const tone = TYPE_TONE[row.typeKind];
  const hollow = row.typeKind === "draft";
  return (
    <span
      /* Colour-coded chip, dialled back on saturation vs the earlier
         `10% bg + 100% text + 20% border` recipe. New treatment:
           · Background: ~6% tone alpha (was 10%)
           · Text:       tone at 78% mix with slate — reads calm, still
                         distinguishes types
           · Border:     10% alpha (was 20%) so the chip edge is a hint
         Draft keeps its hollow variant (no fill, dashed-tone border)
         so it stays visually distinct from committed rows. */
      className="inline-flex items-center rounded-full shrink-0 whitespace-nowrap h-[16px] px-1.5 text-[10px] leading-[12px] 2xl:h-5 2xl:px-2 2xl:text-[11px] 2xl:leading-[14px]"
      style={{
        fontWeight: 500,
        fontFamily: FONT,
        ...(hollow
          ? {
              backgroundColor: "transparent",
              color: `color-mix(in srgb, ${tone} 78%, hsl(var(--foreground)))`,
              border: `1px dashed ${tone}66`,
            }
          : {
              backgroundColor: `${tone}10`,
              color: `color-mix(in srgb, ${tone} 78%, hsl(var(--foreground)))`,
              border: `1px solid ${tone}1A`,
            }),
      }}
    >
      {highlight(row.typeLabel, search)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE REF — link (new tab) when routable, else plain mono text
   ═══════════════════════════════════════════════════════════════ */

function SourceRef({ row, search = "" }: { row: TxRowData; search?: string }) {
  if (!row.sourceRef) return null;
  /* Strip the "SO-" / "PO-" / "PR-" prefix from the visible number
     since the TypePill next to it already communicates the type
     (buyer feedback 2026-07-20: "SO, PO from this we need to
     remove"). Other prefixes (ROP-…, TX-…, synthetic ids) pass
     through unchanged. `row.sourceRef` stays intact for the href
     and for filter matching upstream. */
  const displayRef = row.sourceRef.replace(/^(SO|PO|PR)-/i, "");
  if (row.sourceHref) {
    return (
      <a
        href={row.sourceHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors"
        style={s.cellText}
      >
        {highlight(displayRef, search)}
        <ExternalLink className="size-3 shrink-0" />
      </a>
    );
  }
  return (
    <span className="text-muted-foreground" style={s.cellText}>
      {highlight(displayRef, search)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTION FILTER CHIP
   ═══════════════════════════════════════════════════════════════ */

/* Compact sort chip — same pill-style shell as DirectionChip minus
   the count badge. Used by the toolbar's Newest/Oldest control. */
function SortChip({
  label, active, icon: Icon, onClick,
}: {
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors cursor-pointer shrink-0 text-[10px] font-medium leading-4"
      style={{
        fontFamily: FONT,
        ...(active
          ? { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary))" }
          : { backgroundColor: "transparent", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }),
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "hsl(var(--muted))"; e.currentTarget.style.color = "hsl(var(--foreground))"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; } }}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon className="size-2.5" />
      {label}
    </button>
  );
}

function DirectionChip({
  label, active, count, onClick,
}: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      /* Flat 10px, no responsive bump — buyer 2026-07-19 asked for
         the tx-table pill row to match the graph header row tier. */
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors cursor-pointer shrink-0 text-[10px] font-medium leading-4"
      style={{
        fontFamily: FONT,
        ...(active
          ? { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary))" }
          : { backgroundColor: "transparent", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }),
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "hsl(var(--muted))"; e.currentTarget.style.color = "hsl(var(--foreground))"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; } }}
      onClick={onClick}
    >
      {label}
      <span
        className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-4 h-3.5 px-1"
        style={{
          fontFamily: FONT,
          backgroundColor: active ? "rgba(10, 124, 255, 0.1)" : "hsl(var(--secondary))",
          color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
        }}
      >
        {count}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATE PICKER FIELD — single-date Popover + Calendar with presets
   (ported design from POFiltersModal's DatePickerInput, standalone)
   ═══════════════════════════════════════════════════════════════ */

function DatePickerField({
  label, value, onChange, disabledMatcher,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  disabledMatcher?: React.ComponentProps<typeof Calendar>["disabled"];
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-9 flex items-center justify-between gap-2 rounded-md border border-border px-2.5 transition-all cursor-pointer hover:border-muted-foreground min-w-[150px]"
          style={{
            ...s.uiCaption,
            backgroundColor: "hsl(var(--input-background))",
            color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarDays className="size-3.5 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
            <span className="truncate">{value ? formatDate(value) : `${label}`}</span>
          </div>
          {value && (
            <span
              className="shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <X className="size-3.5 hover:opacity-70 transition-opacity" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
        <div className="p-1">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => {
              if (d) { onChange(toLocalISO(d)); setOpen(false); }
              else onChange("");
            }}
            disabled={disabledMatcher}
            initialFocus
          />
        </div>
        <div className="px-3 py-2.5 border-t border-border flex flex-wrap gap-1.5">
          {[
            { label: "Last 7 days", days: 7 },
            { label: "Last 30 days", days: 30 },
            { label: "Last 90 days", days: 90 },
          ].map((preset) => (
            <button
              key={preset.label}
              className="inline-flex items-center h-7 px-2.5 rounded-full border transition-colors cursor-pointer"
              style={{
                fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT,
                borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--muted-foreground))",
              }}
              onClick={() => {
                const now = new Date();
                const past = new Date(now.getTime() - preset.days * 86400000);
                onChange(toLocalISO(past));
                setOpen(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; e.currentTarget.style.borderColor = "hsl(var(--muted-foreground))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--card))"; e.currentTarget.style.borderColor = "hsl(var(--border))"; }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATE RANGE FIELD — pop-out range Calendar matching the gap graph's
   Custom horizon picker (PlannerWorkspacePage.tsx). Single trigger, a
   2-month range Calendar, and a Cancel / Apply footer that commits the
   picked range as { fromDate, toDate } ISO strings.
   ═══════════════════════════════════════════════════════════════ */

type DateRange = { from?: Date; to?: Date };

function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DateRangeField({
  fromDate,
  toDate,
  onApply,
  onClear,
}: {
  fromDate: string;
  toDate: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>(undefined);
  const active = !!(fromDate && toDate);
  const label = active
    ? `${fmtMonthDay(new Date(fromDate + "T00:00:00"))} – ${fmtFullDate(new Date(toDate + "T00:00:00"))}`
    : "Date range";
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setPending({
            from: fromDate ? new Date(fromDate + "T00:00:00") : undefined,
            to: toDate ? new Date(toDate + "T00:00:00") : undefined,
          });
        }
      }}
    >
      <PopoverTrigger asChild>
        {/* Recipe matches the PO-listing Filters button: h-9, rounded-lg,
            shadow-sm, border-border by default → primary-tint fill +
            primary border when a range is applied. Uses design tokens
            (--primary / --primary-tint / --border) instead of hard-coded
            hex so light/dark themes stay in sync. Clear X is a nested
            button (stopPropagation + role) rather than a bare span so
            the tap target is real and keyboard-reachable. */}
        <button
          type="button"
          title={active ? "Change date range" : "Filter by a custom date range"}
          className={`group inline-flex items-center gap-1 h-7 rounded-lg border px-1.5 text-[11.5px] font-medium shadow-sm transition-colors cursor-pointer 2xl:gap-1.5 2xl:h-9 2xl:px-2.5 2xl:text-[12.5px] ${
            active
              ? ""
              : "border-border text-foreground hover:!bg-muted/40 hover:!text-foreground"
          }`}
          style={{
            fontFamily: FONT,
            backgroundColor: active ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
            borderColor: active ? "hsl(var(--primary))" : undefined,
            color: active ? "hsl(var(--primary))" : undefined,
          }}
        >
          <CalendarDays
            className="size-2.5 2xl:size-3.5"
            style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
          />
          <span className="whitespace-nowrap tabular-nums">{label}</span>
          {active && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClear(); }
              }}
              className="ml-1 inline-flex items-center justify-center size-5 rounded-md transition-colors hover:bg-primary/15"
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="text-[12px] font-semibold text-slate-700">Custom date range</p>
          <p className="text-[11px] text-slate-400">
            {pending?.from && !pending?.to
              ? "Pick the end date"
              : "Pick a start date, then an end date"}
          </p>
        </div>
        <Calendar
          mode="range"
          showOutsideDays={false}
          selected={pending}
          defaultMonth={pending?.from ?? new Date()}
          numberOfMonths={2}
          onSelect={(range, day) => {
            if (
              pending?.from && !pending?.to &&
              range?.from && range?.to &&
              range.from.getTime() === range.to.getTime() &&
              range.from.getTime() === day.getTime()
            ) {
              setPending(undefined);
              return;
            }
            setPending(range);
          }}
          initialFocus
        />
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
          <span className="text-[11px] tabular-nums text-slate-500">
            {pending?.from && pending?.to
              ? `${fmtMonthDay(pending.from)} – ${fmtFullDate(pending.to)}`
              : pending?.from
                ? `${fmtFullDate(pending.from)} – …`
                : "No range selected"}
          </span>
          <div className="flex items-center gap-1.5">
            {pending?.from && (
              <button
                type="button"
                onClick={() => setPending(undefined)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pending?.from || !pending?.to}
              onClick={() => {
                if (!pending?.from || !pending?.to) return;
                onApply(toLocalISO(pending.from), toLocalISO(pending.to));
                setOpen(false);
              }}
              className="rounded-md bg-[#0A77FF] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SORT INDICATOR — binary (asc / desc). Idle columns show a
   ghost-down arrow that reveals on hover; the active column shows
   the current direction in primary color.
   ═══════════════════════════════════════════════════════════════ */

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (active && dir === "asc") return <ArrowUp className="size-3" style={{ color: "hsl(var(--primary))" }} />;
  if (active && dir === "desc") return <ArrowDown className="size-3" style={{ color: "hsl(var(--primary))" }} />;
  return <ArrowDown className="size-3 opacity-0 group-hover/colheader:opacity-40 transition-opacity" />;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PlannerTransactionTable({
  rows,
  density = "condensed",
  defaultPageSize = 20,
  highlightDay = null,
  onHoverRow,
  hiddenColumns,
  rightSlot,
  leftSlot,
  onMinWidthChange,
}: PlannerTransactionTableProps) {

  /* ── State ── */
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  /* Default anchor: datetime asc = chronological, oldest → newest.
     Combined with the todayAnchorIdx scroll effect below, page 1
     opens on today's row (past events still exist above it — buyer
     called them out — but the initial view starts "today going
     forward" as requested). Both sortCol and sortDir are always
     non-null now that the sort is binary. */
  const [sortCol, setSortCol] = useState<TxColumnId>("datetime");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [page, setPage] = useState(1);
  /* Track whether the PANEL (not the viewport) is narrow — the tx
     table can sit inside a resizable split, so the buyer can drag
     it small on a wide screen. Eli 2026-07-30: "when the tx column
     is this compressed, show only 3 page pills; Records per page
     is hidden right now because of the 6 pills". Threshold covers
     the pager's cluster width (Records label + Select + Prev + 3
     pills + Next + edge chevrons) with a safety margin. */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const isNarrowPager = containerWidth > 0 && containerWidth < 640;
  /* Extra-narrow tier (Eli 2026-07-30) — at this width even 3 pills
     push "Records per page" into a wrap. Drop to a single current-
     page pill with only Prev/Next chevrons for navigation. Edge
     first/last (« / ») chevrons also drop at this tier. */
  const isVeryNarrowPager = containerWidth > 0 && containerWidth < 480;
  /* Filters modal — matches the PO listing's Filters button next to
     the search bar + full modal recipe (buyer feedback 2026-07-13:
     "put the filter button next to search and open a modal like the
     PO listing does"). Three dimensions: transaction Type, Party
     (Customer/Vendor), and On-hand Band. */
  const [txFilters, setTxFilters] = useState<PlannerTxFilterState>(EMPTY_TX_FILTERS);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  /* ── Column customization state ──
     Ported from PODataTable's suite (buyer feedback 2026-07-13: "the
     table is too rigid, users can't reorder, resize, or hide"). Three
     in-memory pieces of state:
       · `hiddenColumnIds`  — set of column IDs hidden from the render
       · `internalOrder`    — the order columns appear in (default = COLUMNS)
       · `columnWidths`     — per-column width overrides driven by the
                              4px right-edge drag handle on every header
     Persistence is intentionally in-memory only — matches PODataTable's
     behavior, and the tab-key rehydrates the defaults if the buyer
     wants a reset. The `hiddenColumns` prop still seeds the initial
     value so the existing external override remains supported. */
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<TxColumnId>>(
    () => new Set(hiddenColumns ?? []),
  );
  const [internalOrder, setInternalOrder] = useState<TxColumnId[]>(
    () => COLUMNS.map((c) => c.id),
  );
  const [columnWidths, setColumnWidths] = useState<Partial<Record<TxColumnId, number>>>({});
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const resizeRef = useRef<{ colId: TxColumnId; startX: number; startW: number } | null>(null);

  /* Locked columns — the frozen `datetime` column stays first + can't
     be hidden. It anchors the Today divider + sort logic; hiding it
     would break the ledger's chronological identity. */
  const LOCKED_COLUMN_IDS: TxColumnId[] = ["datetime"];

  /* ── Density padding ── */
  const vPad = density === "comfort" ? "10px" : "4px";

  /* ── Visible columns ──
     Composes three inputs: reorder (internalOrder), hide (hiddenColumnIds),
     resize (columnWidths). The width override is layered onto the base
     column def so downstream sticky-offset + minWidth math still works. */
  const visibleColumns = useMemo(() => {
    const byId = new Map<TxColumnId, TxColumnDef>(COLUMNS.map((c) => [c.id, c]));
    return internalOrder
      .map((id) => byId.get(id))
      .filter((c): c is TxColumnDef => !!c && !hiddenColumnIds.has(c.id))
      .map((c) => ({ ...c, width: columnWidths[c.id] ?? c.width }));
  }, [internalOrder, hiddenColumnIds, columnWidths]);
  const frozenColumns = useMemo(() => visibleColumns.filter((c) => c.frozen), [visibleColumns]);

  /* Column-selector adapters — its API takes `{key,label}[]` + a
     `Record<string, boolean>` visibility map. Kept close to the state
     so any future column additions surface here in one place. */
  const columnConfigs: ColumnConfig[] = useMemo(
    () => internalOrder
      .map((id) => COLUMNS.find((c) => c.id === id))
      .filter((c): c is TxColumnDef => !!c)
      .map((c) => ({ key: c.id, label: c.label })),
    [internalOrder],
  );
  const columnVisibility: Record<string, boolean> = useMemo(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, !hiddenColumnIds.has(c.id)])),
    [hiddenColumnIds],
  );

  const handleColumnOrderChange = useCallback((next: string[]) => {
    /* Guard: the selector may hand back strings outside our TxColumnId
       union in edge cases (e.g. renamed columns during hot reload).
       Filter to known IDs and preserve the caller's ordering. */
    const validIds = new Set(COLUMNS.map((c) => c.id) as string[]);
    setInternalOrder(next.filter((id): id is TxColumnId => validIds.has(id)));
  }, []);

  const handleColumnVisibilityChange = useCallback((next: Record<string, boolean>) => {
    setHiddenColumnIds(
      new Set(
        COLUMNS
          .filter((c) => next[c.id] === false && !LOCKED_COLUMN_IDS.includes(c.id))
          .map((c) => c.id),
      ),
    );
  }, []);

  /* Resize handler — matches PODataTable's mousedown-move-up pattern
     (`PODataTable.tsx:837-849`). Body cursor + user-select overrides
     make the drag feel snappy without picking up text selection. */
  const handleResizeStart = useCallback((e: React.MouseEvent, colId: TxColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    const col = COLUMNS.find((c) => c.id === colId);
    const startW = columnWidths[colId] ?? col?.width ?? 120;
    resizeRef.current = { colId, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const c = COLUMNS.find((x) => x.id === resizeRef.current!.colId);
      const next = Math.max(
        c?.minWidth ?? 60,
        resizeRef.current.startW + ev.clientX - resizeRef.current.startX,
      );
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.colId]: next }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [columnWidths]);

  /* Cumulative left offset for each frozen column (sticky positioning). */
  const frozenLeftOffset = useMemo(() => {
    const map: Partial<Record<TxColumnId, number>> = {};
    let acc = 0;
    for (const c of frozenColumns) { map[c.id] = acc; acc += c.width; }
    return map;
  }, [frozenColumns]);
  const lastFrozenId = frozenColumns.length ? frozenColumns[frozenColumns.length - 1].id : null;

  /* ── Direction tab counts (over the search-filtered set so chips reflect what's searchable) ── */
  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.displayId.toLowerCase().includes(q) ||
      r.typeLabel.toLowerCase().includes(q) ||
      (r.sourceRef ?? "").toLowerCase().includes(q) ||
      r.party.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const dirCounts = useMemo(() => ({
    all: searchFiltered.length,
    incoming: searchFiltered.filter((r) => r.direction === "incoming").length,
    outgoing: searchFiltered.filter((r) => r.direction === "outgoing").length,
  }), [searchFiltered]);

  /* ── Full filter chain: search → direction → date range → chip filters ── */
  const filtered = useMemo(() => {
    const typeSet = new Set(txFilters.typeKinds);
    const partySet = new Set(txFilters.parties);
    const bandSet = new Set(txFilters.bands);
    return searchFiltered.filter((r) => {
      if (directionFilter !== "all" && r.direction !== directionFilter) return false;
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      if (typeSet.size > 0 && !typeSet.has(r.typeKind)) return false;
      if (partySet.size > 0 && !partySet.has(r.party)) return false;
      if (bandSet.size > 0 && !bandSet.has(r.band)) return false;
      return true;
    });
  }, [searchFiltered, directionFilter, fromDate, toDate, txFilters]);

  /* Faceted options for the chip popovers — derived from the row set
     BEFORE the chip filters apply, so removing a filter can still
     surface previously-hidden values. Party names are deduped. */
  const facetedParties = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.party) seen.add(r.party);
    }
    return Array.from(seen);
  }, [rows]);
  const facetedTypeKinds = useMemo(() => {
    const seen = new Set<TxRowData["typeKind"]>();
    for (const r of rows) seen.add(r.typeKind);
    return Array.from(seen);
  }, [rows]);

  /* ── Sorting ──
     `isChrono` — chronological order (Oldest-first, asc). Drives the
     today anchor + Today divider + min/max crossing annotations, all
     of which only read right past → future going down. Newest-first
     (desc) has no anchor: it starts on page 1, the natural top of the
     sort, which is where the *latest* transaction lives. */
  const isChrono = sortCol === "datetime" && sortDir === "asc";

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dirMul = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortCol) {
        case "id":
          return dirMul * a.displayId.localeCompare(b.displayId);
        case "typeSource":
          return dirMul * a.typeLabel.localeCompare(b.typeLabel);
        case "datetime": {
          const av = `${a.date}T${a.time}`;
          const bv = `${b.date}T${b.time}`;
          return dirMul * av.localeCompare(bv);
        }
        case "party":
          return dirMul * a.party.localeCompare(b.party);
        case "plannedQty":
          return dirMul * (a.plannedQty - b.plannedQty);
        case "processedQty":
          return dirMul * ((a.processedQty ?? -Infinity) - (b.processedQty ?? -Infinity));
        case "price":
          return dirMul * ((a.linePrice ?? -Infinity) - (b.linePrice ?? -Infinity));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  /* Reset to page 1 on any filter / sort / page-size change. */
  useEffect(() => { setPage(1); }, [search, directionFilter, fromDate, toDate, pageSize, sorted.length]);

  /* Clamp page if the dataset shrinks below the current page. */
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  /* ── Today anchor + smooth scroll on mount and on sort switch ──
     Planning-surface convention (Google Calendar agenda, Linear
     timeline, Notion Calendar, Asana Timeline, MS Project, Jira,
     GitHub Projects Roadmap): open anchored on TODAY — past events
     scrollable one way, upcoming the other — instead of on the
     top row of the sort. On this table that means:
       1. Pick the row closest to today (see `todayAnchorIdx` below).
       2. Jump the paginator to the page containing that anchor.
       3. Once that page renders, smooth-scroll the today-row to the
          TOP of the viewport (`block: "start"`), so both Newest-first
          and Oldest-first *start* at today. Native ease-out settles.
     The anchor re-fires whenever `sortCol`/`sortDir` changes (so
     switching Newest ↔ Oldest lands the buyer back on today's row in
     the reordered list — both sorts show the same transactions, just
     in the other order). It does NOT re-fire on search / direction /
     date-range / hover changes; buyers refining those expect their
     scroll position preserved. `sortSignatureRef` compares the last-
     anchored sort against the current one, and `pendingScrollRef`
     defers the actual `scrollIntoView` to the layout effect once the
     paginator has caught up to the target page. */
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayAnchorRef = useRef<HTMLTableRowElement>(null);
  const sortSignatureRef = useRef<string>("");
  const pendingScrollRef = useRef(false);

  /* Anchor row index inside `sorted` — the row we'll snap the scroll to.
     Only meaningful when the table is sorted chronologically (asc); any
     other sort/column leaves scroll position alone. In asc the first
     row with `daysFromToday >= 0` is the past → future pivot; if the
     dataset is all past, fall back to the last row (newest available). */
  const todayAnchorIdx = useMemo(() => {
    if (!isChrono) return -1;
    const firstFuture = sorted.findIndex((r) => r.daysFromToday >= 0);
    if (firstFuture !== -1) return firstFuture;
    return sorted.length > 0 ? sorted.length - 1 : -1;
  }, [sorted, isChrono]);

  /* Snap the paginator on mount AND whenever the buyer switches
     Newest ↔ Oldest. Two branches:
       · Oldest first (asc, `isChrono`) — jump to the page holding
         today's row and smooth-scroll to it. Past above, future below.
       · Newest first (desc) — jump to page 1. That IS the top of the
         sort (latest transactions), so no anchor row is needed. Past
         rows sit below and are reachable via the paginator.
     Guarded by `sortSignatureRef` so unrelated re-renders can't
     re-fire the effect; filter/search/date changes never trigger it. */
  useEffect(() => {
    if (sortCol !== "datetime") return;
    const sig = `${sortCol}:${sortDir}`;
    if (sortSignatureRef.current === sig) return;
    sortSignatureRef.current = sig;
    if (sortDir === "asc") {
      if (todayAnchorIdx < 0) return;
      pendingScrollRef.current = true;
      const targetPage = Math.floor(todayAnchorIdx / pageSize) + 1;
      if (targetPage !== page) setPage(targetPage);
    } else {
      // Newest first — natural top-of-sort is page 1.
      if (page !== 1) setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortCol, sortDir, todayAnchorIdx, pageSize]);

  /* Once the target page is rendered, smooth-scroll to the anchor row.
     `useLayoutEffect` runs before paint so we can measure the row and
     issue the scroll on the same frame. Guarded by `pendingScrollRef`
     so the effect stays a no-op on unrelated `page` changes (e.g. the
     paginator resetting to 1 on a filter refinement). */
  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    if (todayAnchorIdx < 0) return;
    const targetPage = Math.floor(todayAnchorIdx / pageSize) + 1;
    if (page !== targetPage) return; // wait for the page to catch up
    /* Clear the flag BEFORE the rAF so a redundant re-render (React
       StrictMode double-fire, or a state update after `setPage`) can't
       schedule a second scrollIntoView. */
    pendingScrollRef.current = false;
    const raf = requestAnimationFrame(() => {
      /* `block: "start"` — today's row settles at the TOP of the scroll
         viewport (not the middle), so buyers always "start the table
         from today" regardless of sort direction. In Oldest-first (asc)
         the past rows are above and scroll UP reveals them; in Newest-
         first (desc) the future/latest rows are above and scroll UP
         reveals those instead. */
      todayAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [page, todayAnchorIdx, pageSize]);

  /* ── Auto-scroll on graph→table hover ─────────────────────────
     When the buyer hovers a dot / column on the graph, `highlightDay`
     lands here. A day can hold multiple events (up to ~10 in dense
     projections), so the auto-scroll now anchors the WHOLE group
     rather than just the first row:
       · Find every `<tr data-highlight-day="{day}">` on the page.
       · Measure the group's top + bottom offset in the scroll
         container's coordinate system.
       · Compute a target scroll that lands the first row `PAD_TOP`
         below the sticky `<thead>` — guaranteeing the top row is
         never tucked under the header. Small buffer at the bottom
         when the group fits; overflow below when it doesn't (10-
         event days can't fit in the drawer, so give them max space
         upward and let the buyer scroll for the tail).
     Buyer feedback 2026-07-14: "when a day has 3 events it brought
     up only 2. Don't hard-center; use minimum padding … never tuck
     the last one under the header." Previous `scrollIntoView(nearest)`
     picked one row and let the sticky thead cover the neighbours. */
  /* Padding budget for the auto-scroll anchor. Tuned 2026-07-14 to
     leave meaningful context on both sides of the day's event group:
       · MIN_PAD_TOP    — never less than this above the first row.
                          Sized so the "Going below X" band divider
                          that renders just above the group is fully
                          visible (dividers ≈ 24 px + a hair of room).
       · MIN_PAD_BOTTOM — mirror for the row after the group so
                          buyers still see downstream context.
     When the group fits the viewport with lots of room to spare,
     use HALF of the remaining slack above the group (soft-center) —
     so the day feels centered rather than pinned to the top. When
     the group is taller than the viewport, top-anchor with MIN_PAD_TOP
     so the first row + preceding band divider are guaranteed visible;
     the tail overflows below (10-event days). */
  const MIN_PAD_TOP = 44;
  const MIN_PAD_BOTTOM = 32;
  useLayoutEffect(() => {
    if (highlightDay == null) return;
    const idx = sorted.findIndex((r) => r.daysFromToday === highlightDay);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
      /* Page change triggers a re-render; the scroll retry below runs
         in the follow-up layout effect once the row is on this page. */
      return;
    }
    const raf = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rows = container.querySelectorAll<HTMLTableRowElement>(
        `tr[data-highlight-day="${highlightDay}"]`,
      );
      if (rows.length === 0) return;
      /* Sticky thead height — measured live so a design-token bump
         to header padding doesn't silently regress the top-guard. */
      const headerEl = container.querySelector<HTMLTableSectionElement>("thead");
      const headerH = headerEl?.getBoundingClientRect().height ?? 0;
      const containerRect = container.getBoundingClientRect();
      const first = rows[0];
      const last = rows[rows.length - 1];
      const firstRect = first.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      /* Offsets in the container's scroll coordinate system. */
      const firstTop = firstRect.top - containerRect.top + container.scrollTop;
      const lastBottom = lastRect.bottom - containerRect.top + container.scrollTop;
      const groupH = lastBottom - firstTop;
      const visibleH = container.clientHeight;
      const usableH = visibleH - headerH;
      let above: number;
      if (groupH + MIN_PAD_TOP + MIN_PAD_BOTTOM <= usableH) {
        /* Group fits with room to spare — soft-center: put half of
           the slack above, at least MIN_PAD_TOP. Result feels
           balanced (context visible top + bottom) without a rigid
           "exact middle" that could reposition on tiny slack. */
        const slack = usableH - groupH;
        above = Math.max(MIN_PAD_TOP, Math.floor(slack / 2));
        /* Cap `above` so we never eat into the bottom pad — keeps
           MIN_PAD_BOTTOM of context below the last row too. */
        above = Math.min(above, usableH - groupH - MIN_PAD_BOTTOM);
      } else {
        /* Group taller than the viewport: anchor first row just
           below the header + MIN_PAD_TOP. Tail rows overflow below;
           buyer scrolls for the rest. Top + preceding band divider
           always visible — no tuck-under-header. */
        above = MIN_PAD_TOP;
      }
      let targetScroll = firstTop - headerH - above;
      /* Clamp to valid scroll range so we don't overshoot. */
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
      container.scrollTo({ top: targetScroll, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightDay, sorted, pageSize, page]);

  /* ── Flash-highlight newly-added rows ─────────────────────────
     When the graph fires `onSimulateAdd` / `onPlotVendor`, or the
     workspace turns on Auto and generates planned POs, a new row
     appears in `rows` on next render. Highlight it for ~2.5s and fade
     out so the buyer sees the arrival — a common "just-added" pattern
     (Linear, Notion, Airtable use the same technique for row inserts).

     Only rows the buyer can ADD get flashed: planned POs (manual or
     auto) and simulated what-ifs. Real POs / SOs / drafts / demand
     events are seeded once and shouldn't ever flash — buyer feedback
     2026-07-20: "when I am doing auto why everything is turning into
     green? we just need to highlight the planned PO that we have
     added in case of auto." Without this gate any incidental
     re-shuffle in the row set (e.g. a running-balance walk changing
     an event's band that's used downstream) can register as "new".
     Diffs the row-ID set against the previous render. */
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const currentIds = new Set(rows.map((r) => r.id));
    if (knownIdsRef.current === null) {
      // First render — seed the known-set without flashing anything.
      knownIdsRef.current = currentIds;
      return;
    }
    /* Capture the previous known-set BEFORE the ref is updated so the
       page-jump lookup below can identify which rows are new. */
    const prevKnown = knownIdsRef.current;
    /* Only flash rows the buyer can actively add — planned POs and
       simulated txns. Real POs / SOs / drafts / demand events are
       seeded once and never flash. */
    const flashable = new Set(
      rows.filter((r) => r.isPlanned || r.isSimulated).map((r) => r.id),
    );
    const added: string[] = [];
    currentIds.forEach((id) => {
      if (!prevKnown.has(id) && flashable.has(id)) added.push(id);
    });
    knownIdsRef.current = currentIds;
    if (added.length === 0) return;
    const addedSet = new Set(added);
    setFlashIds((prev) => {
      const next = new Set(prev);
      added.forEach((id) => next.add(id));
      return next;
    });
    /* If the newly-added row lives on a different pagination page than
       the one the buyer is looking at, jump to that page so the flash
       is actually visible. Uses the earliest added row's index in the
       current sort. If the row is already on the visible page, don't
       touch pagination. */
    const firstAddedIdx = sorted.findIndex((r) => addedSet.has(r.id));
    if (firstAddedIdx >= 0) {
      const targetPage = Math.floor(firstAddedIdx / pageSize) + 1;
      if (targetPage !== page) setPage(targetPage);
    }
    const t = setTimeout(() => {
      setFlashIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        added.forEach((id) => next.delete(id));
        return next;
      });
    }, 2500);
    return () => clearTimeout(t);
    // Only react to `rows`. `sorted`/`pageSize`/`page` are read fresh for
    // the page-jump decision; adding them as deps would re-fire this on
    // every sort or page change with no new row, spamming the diff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* ── Sort handler — binary flip (asc ↔ desc) ──
     Same column click: reverse direction. Different column click:
     switch to that column, reset to asc. Never lands on "no sort" —
     that state was surfacing insertion-order rows that read as
     random on a chronological ledger. */
  const handleSort = useCallback((id: TxColumnId) => {
    setSortCol((prevCol) => {
      if (prevCol !== id) {
        setSortDir("asc");
        return id;
      }
      setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
      return id;
    });
  }, []);

  /* ── Cell renderer ── */
  const renderCell = useCallback((col: TxColumnDef, row: TxRowData): React.ReactNode => {
    switch (col.id) {
      case "id":
        return (
          <span
            className="truncate block"
            style={{ ...s.cellId, color: "hsl(var(--foreground))" }}
            title={row.displayId}
          >
            {highlight(row.displayId, search)}
          </span>
        );

      case "typeSource": {
        /* Direction arrow prefix — arrow takes the row's type tone
           instead of a fixed green/red for direction (buyer feedback
           2026-07-13: "looking all over the place" — the coral
           outgoing arrow was clashing with an orange PR pill sitting
           inches to its right). Direction is still readable through
           arrow *shape* (↑ vs ↓); tone alignment turns each row into
           a single-hue unit that reads calm. Both the arrow and the
           pill text are mixed 68% with slate so the whole cell stays
           muted. */
        const isIn = row.direction === "incoming";
        const ArrowIcon = isIn ? ArrowUp : ArrowDown;
        const tone = TYPE_TONE[row.typeKind];
        const arrowColor = `color-mix(in srgb, ${tone} 68%, hsl(var(--muted-foreground)))`;
        /* Buyer feedback 2026-07-20 revision: drop the pill and lay
           out type + reference as two plain-text lines that mirror
           the Date column's shape — main label on top, muted
           reference below with a small external-link glyph. Arrow
           stays as the visual direction anchor. Reference number
           has the "SO-" / "PO-" / "PR-" prefix stripped (the type
           label above already declares the type). */
        const displayRef = row.sourceRef
          ? row.sourceRef.replace(/^(SO|PO|PR)-/i, "")
          : "";
        return (
          <div className="flex items-center gap-2 min-w-0">
            <ArrowIcon className="size-3 shrink-0" style={{ color: arrowColor }} />
            <div className="flex min-w-0 flex-col leading-tight">
              <span
                style={{
                  ...s.cellText,
                  color: "hsl(var(--foreground))",
                  /* 2-line clamp — buyer 2026-07-30: "planned
                     purchase order needs to stay in 2 lines, it
                     doesn't need to go to third line". */
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {highlight(row.typeLabel, search)}
              </span>
              {displayRef && (
                row.sourceHref ? (
                  <a
                    href={row.sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    style={{ fontFamily: FONT }}
                  >
                    {highlight(displayRef, search)}
                    <ExternalLink className="size-2.5 shrink-0" />
                  </a>
                ) : (
                  <span
                    className="text-[11px] text-muted-foreground"
                    style={{ fontFamily: FONT }}
                  >
                    {highlight(displayRef, search)}
                  </span>
                )
              )}
            </div>
          </div>
        );
      }

      case "datetime":
        return (
          <div className="flex flex-col leading-tight">
            <span
              className="whitespace-nowrap"
              style={{ ...s.cellText, color: "hsl(var(--foreground))" }}
            >
              {formatDate(row.date)}
            </span>
            {row.time && (
              <span className="whitespace-nowrap text-[11px] text-muted-foreground" style={{ fontFamily: FONT }}>{row.time}</span>
            )}
          </div>
        );

      case "party": {
        if (!row.party) {
          return (
            <span
              className="truncate block"
              style={{ ...s.cellText, color: "hsl(var(--muted-foreground))" }}
            >
              —
            </span>
          );
        }
        /* Vendor / customer cell — mirrors the PO listing's partner column:
           a `LetterAvatar`-style square with the party's initials on the
           left, name on the right. Colour is deterministic per name via
           the shared `getAvatarTint` helper. */
        const initials = row.party
          .split(" ")
          .map((w) => w[0] || "")
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const tint = getAvatarTint(row.party);
        return (
          <div className="flex items-center gap-2 min-w-0" title={row.party}>
            <span
              className="inline-flex items-center justify-center shrink-0 overflow-hidden rounded-md border"
              style={{
                width: 22,
                height: 22,
                fontSize: "9px",
                fontWeight: 700,
                fontFamily: FONT,
                backgroundColor: tint.bg,
                color: tint.fg,
                borderColor: "#E8ECF1",
              }}
            >
              {initials}
            </span>
            <span
              className="truncate min-w-0 flex-1"
              style={{ ...s.cellText, color: "hsl(var(--foreground))" }}
            >
              {highlight(row.party, search)}
            </span>
          </div>
        );
      }

      case "plannedQty":
        return (
          /* Signed qty — supply rows read as `+N` in green, demand rows as
             `−N` in red. Matches the reference design so the direction is
             visible in the number itself, not only in the row's arrow.
             nowrap so "+21 EA" stays single-line inside the compressed
             80px column (Eli 2026-07-30). */
          <span
            className="tabular-nums"
            style={{
              ...s.cellText,
              color: row.direction === "incoming" ? "#16A34A" : "#DC2626",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {row.direction === "incoming" ? "+" : "−"}
            {row.plannedQty.toLocaleString("en-US")}
            <span className="text-muted-foreground font-normal"> {row.uom}</span>
          </span>
        );

      case "processedQty":
        return row.processedQty === null ? (
          <span className="tabular-nums text-muted-foreground" style={s.cellText}>—</span>
        ) : (
          <span
            className="tabular-nums"
            style={{
              ...s.cellText,
              color: row.direction === "incoming" ? "#16A34A" : "#DC2626",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {row.direction === "incoming" ? "+" : "−"}
            {row.processedQty.toLocaleString("en-US")}
            <span className="text-muted-foreground font-normal"> {row.uom}</span>
          </span>
        );

      case "onHandBefore":
        return (
          <span className="tabular-nums text-muted-foreground" style={s.cellText}>
            {row.onHandBefore.toLocaleString("en-US")}
          </span>
        );

      case "onHandAfter":
        return (
          <span className="tabular-nums" style={{ ...s.cellText, color: BAND_TONE[row.band], fontWeight: 600 }}>
            {row.onHandAfter.toLocaleString("en-US")}
          </span>
        );

      case "price":
        return row.linePrice === null ? (
          <span className="tabular-nums text-muted-foreground" style={s.cellText}>—</span>
        ) : (
          <div className="flex flex-col leading-tight items-end">
            <span className="tabular-nums" style={{ ...s.cellText, color: "hsl(var(--foreground))" }}>
              {formatCurrency(row.linePrice)}
            </span>
            {row.unitPrice !== null && (
              <span className="text-[11px] text-muted-foreground tabular-nums" style={{ fontFamily: FONT }}>
                @ {formatCurrency(row.unitPrice)}
              </span>
            )}
          </div>
        );

      default:
        return null;
    }
  }, [search]);

  /* Proportional widths — Eli 2026-07-30 ("every cell needs to
     increase or decrease the width; there is a lot of negative
     space"). We express each column as a % of the total configured
     width. Combined with `table-layout: fixed` + `width: 100%`
     the browser distributes any extra panel width across every
     column proportionally instead of dumping it all into Party.
     `minWidth` still enforces per-column floors so narrow panels
     scroll horizontally rather than crushing cells. */
  const totalConfiguredWidth = visibleColumns.reduce(
    (sum, c) => sum + c.width,
    0,
  ) || 1;
  const widthPct = (col: TxColumnDef) => (col.width / totalConfiguredWidth) * 100;

  /* ── Header cell base style ── */
  const headerCellStyle = (col: TxColumnDef): React.CSSProperties => {
    return {
      ...s.thLabel,
      width: `${widthPct(col)}%`,
      minWidth: col.minWidth,
      padding: "1px 8px",
      backgroundColor: HEADER_BG,
      borderBottom: "1px solid hsl(var(--border))",
      color: "hsl(var(--muted-foreground))",
      ...(col.frozen
        ? {
            position: "sticky",
            left: frozenLeftOffset[col.id] ?? 0,
            zIndex: 30,
            ...(col.id === lastFrozenId ? { boxShadow: STICKY_SHADOW_LEFT } : {}),
          }
        : {}),
    };
  };

  /* ── Body cell base style ── */
  const bodyCellStyle = (col: TxColumnDef): React.CSSProperties => {
    return {
      padding: `${vPad} 8px`,
      borderBottom: "1px solid hsl(var(--border))",
      fontSize: "14px",
      width: `${widthPct(col)}%`,
      minWidth: col.minWidth,
      ...(col.frozen
        ? {
            position: "sticky",
            left: frozenLeftOffset[col.id] ?? 0,
            zIndex: 10,
            backgroundColor: "inherit",
            ...(col.id === lastFrozenId ? { boxShadow: STICKY_SHADOW_LEFT } : {}),
          }
        : {}),
    };
  };

  const colCount = visibleColumns.length;
  const tableMinWidth = visibleColumns.reduce((acc, c) => acc + c.width, 0);
  /* Notify the parent so it can shrink the tx panel when columns are
     hidden. Firing inside useEffect keeps React happy with side
     effects; the parent guards against redundant sets. */
  useEffect(() => {
    onMinWidthChange?.(tableMinWidth);
  }, [tableMinWidth, onMinWidthChange]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */

  return (
    /* Outer shell — flex-ROW so the `ColumnSelector` inline sidebar
       (`pocColumnSelector.tsx`) can dock to the right of the table
       (same pattern PODemands uses at `PODemands.tsx:4061`). The
       previous flex-col mount pushed the drawer to the bottom of
       the shell and stole the table's vertical space, which is why
       the body read as "data is not available" when the panel was
       open. Border/rounded chrome lives here so the drawer's
       `border-l` seals against the shell edge. */
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex overflow-hidden rounded-[var(--radius-lg)] border border-border"
      style={{ backgroundColor: "hsl(var(--card))", fontFamily: FONT }}
    >
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* ─── TOOLBAR ROW 1 — Search · Date range · primary host actions ───
         Mirrors the Purchase Orders listing pattern (`PODataTable.tsx:1097`):
         search+top-right actions live in row 1; filter/sort/state chips
         move to row 2 below. */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-border 2xl:px-4 2xl:py-2.5" style={{ backgroundColor: "hsl(var(--card))" }}>
        <div className="flex items-center gap-1.5 flex-wrap 2xl:gap-2.5">
          {/* Search — rounded-lg + shadow-sm to align with the PO listing's
              toolbar recipe; clear X gets a proper hoverable pill so the
              tap target is visible instead of a bare glyph. */}
          <div className="relative min-w-[180px] flex-1 xl:max-w-[360px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 2xl:left-3 2xl:size-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            <input
              type="text"
              placeholder="Search by ID, type, source, party…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={75}
              className="h-7 w-full rounded-lg border border-border pl-7 pr-7 text-[11.5px] shadow-sm outline-none transition-all placeholder:text-muted-foreground/70 hover:border-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/15 2xl:h-9 2xl:pl-9 2xl:pr-9 2xl:text-[13px]"
              style={{ fontFamily: FONT, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-4 rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground 2xl:right-1.5 2xl:size-6"
              >
                <X className="size-2.5 2xl:size-3.5" />
              </button>
            )}
          </div>

          {/* Filters button — sits immediately next to the search field,
              same slot the PO listing uses (PODataTable.tsx:1020). Opens
              the PlannerTxFiltersModal below. Badge shows the active
              filter-category count. */}
          <PlannerTxFiltersTrigger
            activeCount={countTxFilters(txFilters)}
            open={filtersModalOpen}
            onClick={() => setFiltersModalOpen(true)}
          />

          {/* Right cluster — date range + Columns picker + host primary
              action, right-aligned. Columns lives BEFORE the host slot so
              the sandbox's "Simulate/Add" primary action stays visually
              anchored at the far right (mirrors the PO listing toolbar). */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <DateRangeField
              fromDate={fromDate}
              toDate={toDate}
              onApply={(f, t) => { setFromDate(f); setToDate(t); }}
              onClear={() => { setFromDate(""); setToDate(""); }}
            />
            {/* Columns picker — same h-7 → 2xl:h-9 rounded-lg recipe
                as the Filters trigger, DateRange field and Simulate
                button so all four toolbar controls line up in one
                horizontal row on small screens (buyer feedback
                2026-07-20: "the styling for columns button needs to
                be square as well like other buttons"). Count badge
                stays so the buyer can still see how many columns are
                visible at a glance. */}
            <button
              type="button"
              onClick={() => setColumnsPanelOpen(true)}
              title="Manage columns"
              className="inline-flex items-center gap-1 h-7 rounded-lg border px-2 text-[11.5px] font-medium shadow-sm cursor-pointer transition-colors shrink-0 2xl:gap-1.5 2xl:h-9 2xl:px-3 2xl:text-[12.5px]"
              style={{
                fontFamily: FONT,
                backgroundColor:
                  hiddenColumnIds.size > 0 || Object.keys(columnWidths).length > 0
                    ? "#EFF6FF"
                    : "#FFFFFF",
                color: "#0F172A",
                borderColor:
                  hiddenColumnIds.size > 0 || Object.keys(columnWidths).length > 0
                    ? "#BFDBFE"
                    : "hsl(var(--border))",
              }}
            >
              <Columns3 className="size-2.5 2xl:size-3.5" />
              Columns
              <span
                className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
              >
                {visibleColumns.length}
              </span>
            </button>
            {rightSlot && (
              <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TOOLBAR ROW 2 — Direction · Sort · host chips (Draft POs, …) ───
         Same shell as the PO listing's tab-pills row (`PODataTable.tsx:1097`):
         `px-4 py-2 border-b overflow-x-auto`. Chips scroll horizontally on
         narrow viewports rather than wrapping so the search row above stays
         one visual line. */}
      <div
        className="shrink-0 px-2.5 py-1 border-b border-border overflow-x-auto 2xl:px-4 2xl:py-2"
        style={{ backgroundColor: "hsl(var(--card))", scrollbarWidth: "none" }}
      >
        <div className="flex items-center gap-1 2xl:gap-2">
          {/* Direction filter chips — Eli 2026-07-16: pill row simplified.
              The Newest/Oldest sort chips were redundant with the datetime
              column-header sort (same two states); dropped so the pill row
              carries filters only. If deeper event-type filtering is
              needed later, add a dropdown on the column header instead
              of more pills. */}
          <DirectionChip label="All" active={directionFilter === "all"} count={dirCounts.all} onClick={() => setDirectionFilter("all")} />
          <DirectionChip label="Inventory creation" active={directionFilter === "incoming"} count={dirCounts.incoming} onClick={() => setDirectionFilter("incoming")} />
          <DirectionChip label="Consumption" active={directionFilter === "outgoing"} count={dirCounts.outgoing} onClick={() => setDirectionFilter("outgoing")} />

          {/* Host-injected chips (e.g. Draft POs toggle) sit at the end of
              the pill row after a divider so they read as an extension
              of the same group. */}
          {leftSlot && (
            <>
              <div className="w-px h-3.5 bg-border shrink-0 2xl:h-5" />
              {leftSlot}
            </>
          )}
        </div>
      </div>


      {/* ─── TABLE / EMPTY ─── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-planner">

          {sorted.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center py-24 px-6">
              <div className="flex flex-col items-center gap-5 max-w-xs text-center">
                <div className="flex items-center justify-center size-16 rounded-full" style={{ backgroundColor: "hsl(var(--secondary))" }}>
                  <Receipt className="size-7" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", lineHeight: "20px", fontFamily: FONT, color: "hsl(var(--foreground))" }}>
                    No transactions
                  </span>
                  <span style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }}>
                    No transactions match your current search or filters.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <table
              className="w-full border-separate border-spacing-0"
              style={{
                fontFamily: FONT,
                minWidth: tableMinWidth,
                /* fixed layout + width:100% distributes any extra
                   panel width across ALL columns proportionally
                   (Eli 2026-07-30). auto layout let Party absorb
                   everything, leaving huge negative space. */
                tableLayout: "fixed",
              }}
            >
              <thead className="sticky top-0 z-20">
                <tr style={{ height: "32px" }}>
                  {visibleColumns.map((col) => {
                    const isSorted = sortCol === col.id;
                    return (
                      <th
                        key={col.id}
                        className={cn(
                          "relative select-none group/colheader",
                          col.align === "right" ? "text-right" : "text-left",
                        )}
                        style={headerCellStyle(col)}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1.5",
                            col.align === "right" ? "justify-end" : "",
                            col.sortable ? "cursor-pointer" : "",
                          )}
                          onClick={() => col.sortable && handleSort(col.id)}
                        >
                          {/* onHandAfter carries a help tooltip */}
                          {col.id === "onHandAfter" ? (
                            <span
                              className="inline-flex items-center gap-1"
                              title="Projected on-hand AFTER this transaction"
                            >
                              {col.label}
                              <HelpCircle className="size-3 opacity-50" aria-hidden="true" />
                            </span>
                          ) : (
                            col.label
                          )}
                          {col.sortable && <SortIcon active={isSorted} dir={sortDir} />}
                        </div>
                        {/* Resize handle — 4px hit target at the right edge,
                            visible on header hover. Mirrors PODataTable's
                            `PODataTable.tsx:332` recipe exactly. */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize opacity-0 group-hover/colheader:opacity-100 hover:!opacity-100 transition-opacity z-10"
                          style={{ backgroundColor: "hsl(var(--border))" }}
                          onMouseDown={(e) => handleResizeStart(e, col.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  /* Local index of the today-anchor within the current
                     page — used to attach `todayAnchorRef` and render the
                     "Today" divider above the anchor row. `-1` when the
                     anchor lives on a different page. */
                  const pageStart = (page - 1) * pageSize;
                  const localAnchorIdx = todayAnchorIdx - pageStart;
                  const todayLabel = new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return pageData.map((row, idx) => {
                    const isHL = highlightDay != null && row.daysFromToday === highlightDay;
                    /* crossing annotation rows render only in chronological order */
                    const showCrossing = isChrono && row.crossing !== null;
                    /* Today divider only in Oldest first (chronological)
                       — Newest first starts at page 1, no anchor. */
                    const isTodayAnchor = isChrono && idx === localAnchorIdx;
                    /* Whether TODAY sits ON the anchor row (row.daysFromToday === 0)
                       vs strictly in the past looking at the first future row.
                       Determines the divider copy: "Today" vs "Upcoming from today". */
                    const isExactToday = isTodayAnchor && row.daysFromToday === 0;
                    return (
                      <React.Fragment key={row.id}>
                        {/* TODAY divider — a thin blue rule + "Today · Jul 6, 2026"
                            label rendered ABOVE the first row with
                            daysFromToday ≥ 0. Persistent marker in the DOM (per
                            planning-UI convention) so the buyer can re-orient
                            after scrolling; also carries the smooth-scroll ref
                            so the scroll centres exactly on the past/future
                            pivot line. */}
                        {isTodayAnchor && (
                          /* Today divider — annotation row that spans the
                             full table width (colSpan={colCount}), so the
                             blue rule + gradient extend across every
                             column. The LABEL (pill + date) sits inside a
                             `position: sticky; left: 0` wrapper so it
                             stays anchored to the left edge of the scroll
                             viewport when the buyer scrolls horizontally,
                             instead of sliding away with the data
                             columns. `top: "auto"` explicitly disables
                             vertical stickiness — this row still scrolls
                             normally up/down with the rest of the body. */
                          <tr aria-hidden="true" ref={todayAnchorRef}>
                            <td
                              colSpan={colCount}
                              style={{ padding: 0, borderBottom: "none" }}
                            >
                              <div
                                style={{
                                  borderTop: "1px solid #0A77FF",
                                  background:
                                    "linear-gradient(to right, rgba(10,119,255,0.10), rgba(10,119,255,0) 60%)",
                                }}
                              >
                                <div
                                  className="inline-flex items-center gap-1.5"
                                  style={{
                                    position: "sticky",
                                    left: 0,
                                    top: "auto",
                                    padding: "3px 12px 3px 13px",
                                    width: "fit-content",
                                  }}
                                >
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-[1px]"
                                    style={{
                                      backgroundColor: "#0A77FF",
                                      color: "#FFFFFF",
                                      fontSize: "9.5px",
                                      fontWeight: 700,
                                      lineHeight: "14px",
                                      fontFamily: FONT,
                                      letterSpacing: "0.04em",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {isExactToday ? "Today" : "Upcoming"}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      lineHeight: "14px",
                                      fontFamily: FONT,
                                      color: "#0A77FF",
                                    }}
                                  >
                                    {todayLabel}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {showCrossing && row.crossing && (
                          /* Crossing annotation — same sticky pattern as
                             the Today divider. The tone-coloured left
                             bar moves with the LABEL (not the outer
                             row's leftmost edge) so the buyer can still
                             see the band-crossing indicator after
                             scrolling right. */
                          <tr aria-hidden="true">
                            <td
                              colSpan={colCount}
                              style={{
                                padding: 0,
                                borderBottom: "none",
                              }}
                            >
                              <div
                                style={{
                                  backgroundColor: `${BAND_TONE[row.crossing.tone]}0D`,
                                }}
                              >
                                <div
                                  className="inline-flex items-center gap-1.5"
                                  style={{
                                    position: "sticky",
                                    left: 0,
                                    top: "auto",
                                    borderLeft: `3px solid ${BAND_TONE[row.crossing.tone]}`,
                                    padding: "3px 12px 3px 13px",
                                    width: "fit-content",
                                  }}
                                >
                                  <CornerRightDown className="size-3 shrink-0" style={{ color: BAND_TONE[row.crossing.tone] }} />
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      lineHeight: "14px",
                                      fontFamily: FONT,
                                      color: BAND_TONE[row.crossing.tone],
                                    }}
                                  >
                                    {row.crossing.label}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      <tr
                        className="group bg-card hover:bg-[#F0F7FF]"
                        data-highlight-day={row.daysFromToday}
                        style={{
                          /* Hover-highlight (graph↔table) is INSTANT — the
                             1200 ms fade felt sluggish to the buyer. Flash
                             (newly-added-row wash) still uses a soft fade
                             out because its lifecycle is timer-driven, but
                             cross-highlight from the graph snaps on/off
                             with no transition. Blue tone matches the
                             standard row-hover across listing tables
                             (#F0F7FF), not the paler rgba(10,119,255,0.06)
                             it used before. */
                          transition: flashIds.has(row.id)
                            ? "background-color 1200ms ease-out"
                            : "none",
                          ...(flashIds.has(row.id)
                            ? { backgroundColor: "rgba(16, 185, 129, 0.07)" }
                            : isHL
                              ? { backgroundColor: "#F0F7FF" }
                              : {}),
                        }}
                        onMouseEnter={() => onHoverRow?.(row.daysFromToday)}
                        onMouseLeave={() => onHoverRow?.(null)}
                      >
                        {visibleColumns.map((col, ci) => {
                          /* the very first cell carries the highlight left-accent */
                          const accent = isHL && ci === 0;
                          const flashing = flashIds.has(row.id);
                          /* Compliance-band left-edge stripe (feedback 2026-07-10):
                             each movement row gets a 3px coloured bar keyed to
                             the band the projected on-hand sits in AFTER the
                             row. Green healthy is suppressed — it would paint a
                             stripe on every routine row and add noise; the
                             absence of a stripe means "healthy". Highlight /
                             flash overrides still win so they read as top-tier
                             signals. */
                          const bandStripe =
                            row.isMovement && row.band !== "healthy" && ci === 0
                              ? `inset 3px 0 0 0 ${BAND_TONE[row.band]}`
                              : null;
                          return (
                            <td
                              key={col.id}
                              className={col.align === "right" ? "text-right" : "text-left"}
                              style={{
                                ...bodyCellStyle(col),
                                transition: flashing
                                  ? "background-color 1200ms ease-out"
                                  : "none",
                                ...(flashing
                                  ? { backgroundColor: "rgba(16, 185, 129, 0.07)" }
                                  : isHL
                                    ? { backgroundColor: "#F0F7FF" }
                                    : {}),
                                ...(accent
                                  ? { boxShadow: "inset 3px 0 0 0 hsl(var(--primary))" }
                                  : flashing && ci === 0
                                    ? { boxShadow: "inset 3px 0 0 0 #10B981" }
                                    : bandStripe
                                      ? { boxShadow: bandStripe }
                                      : {}),
                              }}
                            >
                              {renderCell(col, row)}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PAGINATION ──
            Matches the partner-listing (ContactsDirectoryPage) design:
            shadcn Select + ghost Buttons, `« ‹ Prev [1] Next › »`.
            Sizing scales down on <2xl so the footer reads at the
            same weight as the toolbar controls (buyer feedback
            2026-07-20: pagination text was oversized on smaller
            screens). */}
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center px-2 py-1 border-t border-border gap-1.5 2xl:px-4 2xl:py-3 2xl:gap-3">
          <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground 2xl:gap-2 2xl:text-sm">
            {/* "Records per page" label hidden on <sm — the Select
                trigger below carries the number, so the label is
                redundant when horizontal space is scarce. */}
            <span className="hidden sm:inline">Records per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(Number(val))}
            >
              {/* !important overrides on h + py — shadcn's SelectTrigger
                  pins h via a `data-[size=default]:h-9` attribute
                  selector that wins over a plain `h-6` on specificity.
                  Force the small footprint here so the trigger reads
                  at the same height as the neighbor buttons. Also
                  shrink the internal ChevronDown icon via a scoped
                  selector so it doesn't dominate the 24px pill. */}
              <SelectTrigger className="!h-6 min-h-0 w-[54px] !px-1.5 !py-0 text-[10.5px] [&_svg]:!size-3 2xl:!h-8 2xl:w-[70px] 2xl:!px-3 2xl:!py-2 2xl:text-sm 2xl:[&_svg]:!size-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-0.5">
            {!isVeryNarrowPager && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 min-w-0 p-0 2xl:h-8 2xl:w-8"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                aria-label="First page"
              >
                <ChevronsLeft className="w-3 h-3 2xl:w-4 2xl:h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-[10.5px] text-muted-foreground 2xl:h-8 2xl:gap-1 2xl:px-3 2xl:text-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-2.5 h-2.5 2xl:w-3.5 2xl:h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            {(() => {
              const pages: (number | "…")[] = [];
              /* Three tiers of compaction:
                 - very narrow (<480px): single current-page pill only
                 - narrow (<640px): up to 3 pills centered on current
                 - normal: standard 1 … N-1 N-2 [N] N+1 N+2 … TOTAL */
              if (isVeryNarrowPager) {
                pages.push(page);
              } else if (isNarrowPager) {
                if (totalPages <= 3) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  let startP = Math.max(1, page - 1);
                  const endP = Math.min(totalPages, startP + 2);
                  startP = Math.max(1, endP - 2);
                  for (let i = startP; i <= endP; i++) pages.push(i);
                }
              } else if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (page > 3) pages.push("…");
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                if (page < totalPages - 2) pages.push("…");
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === "…" ? (
                  <span key={`e${idx}`} className="px-0.5 text-[10.5px] text-muted-foreground 2xl:px-1 2xl:text-sm">...</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 w-6 min-w-0 p-0 text-[10.5px] 2xl:h-8 2xl:w-8 2xl:text-sm ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              );
            })()}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-[10.5px] text-muted-foreground 2xl:h-8 2xl:gap-1 2xl:px-3 2xl:text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-2.5 h-2.5 2xl:w-3.5 2xl:h-3.5" />
            </Button>
            {!isVeryNarrowPager && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 min-w-0 p-0 2xl:h-8 2xl:w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                aria-label="Last page"
              >
                <ChevronsRight className="w-3 h-3 2xl:w-4 2xl:h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Columns manage drawer — same component PODemands already uses,
          so the two planner surfaces speak the same UX (drag-reorder,
          hide/show, search, locked columns). Mounted as a right-side
          sibling in the flex-row shell so it slides in from the right
          and doesn't steal vertical space from the table body. */}
      <ColumnSelector
        columns={columnConfigs}
        columnOrder={internalOrder as unknown as string[]}
        columnVisibility={columnVisibility}
        onColumnOrderChange={handleColumnOrderChange}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        lockedColumns={LOCKED_COLUMN_IDS as unknown as string[]}
        open={columnsPanelOpen}
        onOpenChange={setColumnsPanelOpen}
      />

      {/* Filters modal — matches PO listing's Filters button + modal
          pattern. Portalled by shadcn Dialog, sits outside the flex
          shell in the DOM so overlay covers the whole viewport. */}
      <PlannerTxFiltersModal
        open={filtersModalOpen}
        onOpenChange={setFiltersModalOpen}
        filters={txFilters}
        onFiltersChange={setTxFilters}
        parties={facetedParties}
        typeKinds={facetedTypeKinds}
        filteredCount={filtered.length}
      />
    </div>
  );
}
