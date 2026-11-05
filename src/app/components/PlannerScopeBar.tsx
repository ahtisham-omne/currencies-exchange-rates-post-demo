/* ═══════════════════════════════════════════════════════════════
   PLANNER SCOPE BAR — compact dropdown filter row
   ───────────────────────────────────────────────────────────────
   After the first-run questionnaire applies an initial scope, the
   buyer refines it from this slim row of dropdown filters:

     • Horizon  — single-select window + a Custom From/To range
     • Sources  — multi: Sales Orders · Purchase Requests
     • Category — multi, searchable, scrollable
     • Issues   — multi, color-coded to the Issues-column bands

   Each dropdown writes straight back to `params` via `onChange`.
   Faceted counts on every option teach the shape of the data.

   DESIGN: the popover internals mirror the Partner Manager listing's
   filter dropdowns one-for-one — a titled header with an "is any of"
   operator hint, an inline search box on long lists, shadcn Checkbox
   rows with the option's faceted count on the right, and a "Clear
   selection" footer. Same structure, same spacing, same chrome, so
   the two filtering surfaces feel like one system.

   The shared scope constants (HORIZON_OPTIONS, SOURCE_META,
   BAND_TONE, toggleValue) are exported so the first-run questionnaire
   reads from the same source of truth.
   ═══════════════════════════════════════════════════════════════ */

import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import {
  ClipboardList,
  FileText,
  RotateCcw,
  FlaskConical,
  Clock,
  Layers,
  ShieldAlert,
  ChevronDown,
  Check,
  Search,
  SlidersHorizontal,
  User,
  Users,
  Boxes,
  Plus,
  X,
} from "lucide-react";
import { FONT } from "./designTokens";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import {
  DEFAULT_OVERSTOCK_THRESHOLD,
  DEFAULT_PARAMS,
  NO_NARROWING_PARAMS,
  SHOW_PURCHASE_REQUESTS_IN_PLANNER,
  bandLabel,
  LEVEL_BANDS_BY_SEVERITY,
  paramsEqual,
  type LevelBand,
  type OverstockThreshold,
  type ProcurementPlanningParams,
} from "./procurementPlanningParams";

/* Source kind union — mirrors the literal union in PODemands.tsx.
   Kept local so this component has no import dependency on the
   listing; the unions are structurally identical so the count
   records pass through without a cast. */
export type DemandSourceKind = "SO" | "Request" | "LowStock";

export const HORIZON_OPTIONS: Array<{ value: number; label: string }> = [
  /* "All time" pinned first — the default landing state per buyer
     feedback 2026-07-10 (show everything until the user picks a shorter
     window). Uses ALL_TIME_HORIZON as the sentinel value; the scope
     questionnaire renders it as a bare "All time" pill (no "Next"
     prefix); summary / timing helpers switch to unbounded phrasing. */
  { value: 10000, label: "All time" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "6 months" },
  { value: 365, label: "12 months" },
];

/* Sources — Sales Orders only while Purchase Requests are parked
   from procurement (2026-07-20 flag SHOW_PURCHASE_REQUESTS_IN_PLANNER).
   Low Stock is NOT a demand source — it equals "Below Minimum" and
   lives in the Issues filter — so it is intentionally absent here. */
export const SOURCE_META: Array<{
  value: DemandSourceKind;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  explain: string;
}> = [
  {
    value: "SO",
    label: "Sales Orders",
    Icon: FileText,
    explain: "Confirmed customer orders that consume this item.",
  },
  ...(SHOW_PURCHASE_REQUESTS_IN_PLANNER
    ? ([
        {
          value: "Request" as DemandSourceKind,
          label: "Purchase Requests",
          Icon: ClipboardList,
          explain: "Internal requests to buy this item.",
        },
      ])
    : []),
];

/* Severity tone per band — mirrors the Issues-column badge colors so
   the filter dot and the table badge speak the same visual language. */
export const BAND_TONE: Record<
  LevelBand,
  { dot: string; fg: string; bg: string; border: string }
> = {
  "below-zero": { dot: "#DC2626", fg: "#B91C1C", bg: "#FEF2F2", border: "#FCA5A5" },
  "below-min": { dot: "#EA580C", fg: "#C2410C", bg: "#FFF7ED", border: "#FDBA74" },
  /* Above-max = overstock. Teal is a FRESH tone (distinct from every
     other band's red/amber/slate), semantically reads "capital tied
     up" rather than an availability warning. Nophil 2026-07-14. */
  "above-max": { dot: "#0F766E", fg: "#115E59", bg: "#F0FDFA", border: "#5EEAD4" },
  "below-max": { dot: "#64748B", fg: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
};

export function toggleValue<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/* ─── Custom planning-window date helpers — shared shape with the
   first-run questionnaire so the bar and the modal stay in sync. ─── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
/* "2026-07-15" → "Jul 15" for the compact trigger label. */
function formatShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

/* ─────────────────────────── SHARED PRIMITIVES ─────────────────────────── */

/* Faceted-count badge shown on the right of every option row. */
export function CountBadge({
  children,
  fg,
  bg,
}: {
  children: ReactNode;
  fg: string;
  bg: string;
}) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded text-[10.5px] tabular-nums shrink-0"
      style={{ color: fg, backgroundColor: bg, fontWeight: 600 }}
    >
      {children}
    </span>
  );
}

/* Bold-highlight the matched substring inside an option label. */
function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent" style={{ color: "#0A77FF", fontWeight: 700 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

/* ─────────────────────────── DROPDOWN INTERNALS ─────────────────────────── */

/* Popover header — title + an "is any of" operator hint, matching the
   Partners column-filter popover. */
/* Partners-style popover header — icon + full filter label on the left, an
   inline text "Clear" link pinned to the right (only when at least one
   value is selected). Consumes `onClear` so callers can wire the reset
   directly; `operator` and `count` remain in the signature for existing
   callers but are no longer visually rendered — the Partners header is
   deliberately spare (label + Clear only). */
function PopoverHeader({
  icon: Icon,
  label,
  onClear,
  hasSelection,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  operator?: string;
  count?: ReactNode;
  onClear?: () => void;
  hasSelection?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 border-b border-border"
      style={{ fontFamily: FONT }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {Icon && <Icon className="size-3.5 shrink-0 text-foreground/40" />}
        <span
          className="text-foreground truncate"
          style={{ fontSize: 12, fontWeight: 500, lineHeight: "16px" }}
        >
          {label}
        </span>
      </div>
      {hasSelection && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-primary hover:underline cursor-pointer shrink-0"
          style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

/* Partners-style footer — muted "N of M selected" count, only rendered when
   there is an active selection. Mirrors POFilterBar.MultiSelectChip's
   trailing count block. */
function PopoverFooterCount({
  selected,
  total,
}: {
  selected: number;
  total: number;
}) {
  if (selected <= 0) return null;
  return (
    <div className="px-3 py-2 border-t border-border" style={{ fontFamily: FONT }}>
      <span
        className="text-foreground/40"
        style={{ fontSize: 10, fontWeight: 600, lineHeight: "14px" }}
      >
        {selected} of {total} selected
      </span>
    </div>
  );
}

/* Value-summary helper — mirrors POFilterBar's chip phrasing:
     · empty         → undefined (chip renders no value chunk)
     · one selected  → "is <label>"
     · N selected    → "N selected"
   Buyer feedback 2026-07-13: dropped the "is any of" operator on
   multi-selection chips — reads more like the count summary buyers
   already expect. Callers that need the "You" tag or special single-
   selection labels can pass a custom `singularLabel`. */
function valueSummary(
  count: number,
  singularLabel: string | null,
): string | undefined {
  if (count <= 0) return undefined;
  if (count === 1) return singularLabel ? `is ${singularLabel}` : "1 selected";
  return `${count} selected`;
}

/* Inline search box — Partners pattern: leading icon, clearable, fills
   the popover width. Shown only when the option list is long enough to
   need it. */
function ScopeSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full h-8 pl-8 pr-7 text-[13px] rounded-md border border-border outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/50"
          style={{ fontFamily: FONT, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:bg-muted/60 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* Single-select row (Horizon presets). Click selects + closes. */
function OptionRow({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full py-[7px] px-2.5 rounded-md cursor-pointer transition-colors hover:bg-muted/50 text-left"
      style={{ fontFamily: FONT }}
    >
      <span className="text-[13px]" style={{ fontWeight: on ? 600 : 500, color: on ? "#0A77FF" : "#475569" }}>
        {children}
      </span>
      {on && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
    </button>
  );
}

/* Partners-style multi-select row — square checkbox on the left (draws a
   Check on selection), optional severity dot or source icon, label, and a
   trailing faceted count. Uses the same size / padding / hover / selected
   tokens as POFilterBar.MultiSelectChip's option button so the two lists
   feel identical. */
function CheckOption({
  checked,
  onClick,
  count,
  dot,
  icon: Icon,
  title,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  count?: number;
  dot?: string;
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer text-left ${
        checked ? "bg-primary/5" : "hover:bg-secondary"
      }`}
      style={{ fontFamily: FONT }}
    >
      <div
        className={`flex items-center justify-center size-4 rounded-[3px] border shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-border bg-card"
        }`}
      >
        {checked && <Check className="size-2.5 text-primary-foreground" />}
      </div>
      {dot && (
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      {Icon && <Icon className="size-3 shrink-0 text-foreground/40" />}
      <span
        className="flex-1 min-w-0 truncate text-foreground"
        style={{ fontSize: 12, fontWeight: 400, lineHeight: "18px" }}
      >
        {children}
      </span>
      {count != null && (
        <span
          className="text-foreground/40 shrink-0"
          style={{ fontSize: 10, fontWeight: 600, lineHeight: "14px" }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* "Clear selection" footer — Partners pattern, shown only when the
   dropdown has at least one selection. */
function ClearFooter({ onClear }: { onClear: () => void }) {
  return (
    <>
      <div className="border-t border-border/60" />
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onClear}
          className="text-[12.5px] cursor-pointer transition-colors hover:underline"
          style={{ fontWeight: 600, color: "#0A77FF", fontFamily: FONT }}
        >
          Clear selection
        </button>
      </div>
    </>
  );
}

/* Empty / no-match state inside a popover. */
function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-5 text-center text-[12.5px]" style={{ color: "#94A3B8", fontFamily: FONT }}>
      {children}
    </div>
  );
}

/* ─── Category dropdown body — its own component so the search box can
   own local state for the popover's open lifetime. ─── */
/* ─── Overstock threshold input — number field with local string state so
   typing feels natural (empty, backspacing, mid-word states don't get
   force-snapped to a number by the controlled `value` binding). Commits
   the parsed value on every valid parse; empties commit as 0. Isolated
   subcomponent so the surrounding Popover body can re-render without
   remounting the input (previous inline version lost focus / rejected
   digits mid-type per buyer 2026-07-16). ─── */
function OverstockThresholdInput({
  mode,
  value,
  onChange,
}: {
  mode: "pct" | "qty";
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState<string>(String(value));
  /* Re-sync when the upstream value changes for reasons other than local
     typing (e.g. buyer flipped from % to units — the parent seeds a new
     default). Compare parsed local vs incoming to avoid overriding a
     legit in-progress edit like "1" → "10". */
  useEffect(() => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed !== value) {
      setText(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          /* Only propagate a valid non-negative number; empty / partial
             states hold locally until the buyer types something parseable
             (or blurs — see onBlur). */
          if (raw === "") return;
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(0, n));
        }}
        onBlur={() => {
          if (text.trim() === "") {
            setText("0");
            onChange(0);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-7 w-full rounded-md border border-border pl-2 pr-2 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-ring/20"
        style={{ fontFamily: FONT, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
      />
      <span className="text-[10.5px] text-foreground/50 shrink-0" style={{ fontFamily: FONT }}>
        {mode === "pct" ? "% over max" : "units over max"}
      </span>
    </div>
  );
}

function CategoryBody({
  params,
  onChange,
  categoriesList,
  categoryCodes,
  categoryCounts,
  onConfigure,
}: {
  params: ProcurementPlanningParams;
  onChange: (next: ProcurementPlanningParams) => void;
  categoriesList: string[];
  categoryCodes?: Record<string, string>;
  categoryCounts: Record<string, number>;
  onConfigure?: () => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const labelFor = (c: string) => categoryCodes?.[c] ?? c;
  const filtered = ql
    ? categoriesList.filter(
        (c) => labelFor(c).toLowerCase().includes(ql) || c.toLowerCase().includes(ql),
      )
    : categoriesList;
  /* Search box is always offered here (categories are code-labelled, so a
     filter helps even with a short list). The header count shows how many
     categories the dropdown holds — or, while searching, how many match. */
  const showSearch = categoriesList.length > 1;
  /* Select all / Deselect all — mirrors the Owner popover (buyer
     consistency ask 2026-07-16). Union-with-existing when adding;
     removes only the filtered slice when clearing. */
  const selectedCatSet = new Set(params.categories);
  const filteredCatSelectedCount = filtered.filter((c) => selectedCatSet.has(c)).length;
  const allFilteredCatSelected =
    filtered.length > 0 && filteredCatSelectedCount === filtered.length;
  const toggleAllCategories = () => {
    if (allFilteredCatSelected) {
      const remaining = params.categories.filter((c) => !filtered.includes(c));
      onChange({ ...params, categories: remaining });
    } else {
      const merged = Array.from(new Set([...params.categories, ...filtered]));
      onChange({ ...params, categories: merged });
    }
  };

  return (
    <div>
      <PopoverHeader
        icon={Layers}
        label="Category"
        hasSelection={params.categories.length > 0}
        onClear={() => onChange({ ...params, categories: [] })}
      />
      {showSearch && <ScopeSearch value={q} onChange={setQ} placeholder="Search categories…" />}
      {filtered.length > 1 && (
        <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
          <button
            type="button"
            onClick={toggleAllCategories}
            className="text-primary hover:underline cursor-pointer"
            style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT }}
          >
            {allFilteredCatSelected ? "Deselect all" : "Select all"}
            {ql && ` (${filtered.length})`}
          </button>
        </div>
      )}
      <div className="max-h-[240px] overflow-y-auto py-1 px-1">
        {filtered.length === 0 ? (
          <EmptyRow>{categoriesList.length === 0 ? "No categories" : "No matches"}</EmptyRow>
        ) : (
          filtered.map((cat) => (
            <CheckOption
              key={cat}
              checked={params.categories.includes(cat)}
              count={categoryCounts[cat] ?? 0}
              onClick={() => onChange({ ...params, categories: toggleValue(params.categories, cat) })}
            >
              {highlightMatch(labelFor(cat), q)}
            </CheckOption>
          ))
        )}
      </div>
      {onConfigure && (
        <div className="border-t border-border px-1 py-1">
          <button
            type="button"
            onClick={onConfigure}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] text-primary hover:bg-secondary transition-colors cursor-pointer"
            style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500 }}
          >
            <SlidersHorizontal className="size-3.5" />
            Manage Categories
          </button>
        </div>
      )}
      <PopoverFooterCount selected={params.categories.length} total={categoriesList.length} />
    </div>
  );
}

/* ─── Owner dropdown body — searchable checklist, its own search state
   (mirrors CategoryBody). Names with the buyer's own get a "(You)" tag. ─── */
function OwnerBody({
  params,
  onChange,
  ownerOptions,
}: {
  params: ProcurementPlanningParams;
  onChange: (next: ProcurementPlanningParams) => void;
  ownerOptions: { value: string; label: string; count: number; isMe: boolean }[];
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql ? ownerOptions.filter((o) => o.label.toLowerCase().includes(ql)) : ownerOptions;
  const showSearch = ownerOptions.length > 6;
  /* Select all / Deselect all — Partners multi-select pattern. When
     a search is active we toggle only the FILTERED rows so the buyer
     can select-all-matching without wiping their existing selection.
     Buyer feedback 2026-07-14. */
  const filteredValues = filtered.map((o) => o.value);
  const selectedSet = new Set(params.purchasingOwners);
  const filteredSelectedCount = filteredValues.filter((v) => selectedSet.has(v)).length;
  const allFilteredSelected =
    filteredValues.length > 0 && filteredSelectedCount === filteredValues.length;
  const toggleAll = () => {
    if (allFilteredSelected) {
      // Deselect just the filtered rows; keep others intact.
      const remaining = params.purchasingOwners.filter((v) => !filteredValues.includes(v));
      onChange({ ...params, purchasingOwners: remaining });
    } else {
      // Add all filtered rows (union with existing selection).
      const merged = Array.from(new Set([...params.purchasingOwners, ...filteredValues]));
      onChange({ ...params, purchasingOwners: merged });
    }
  };
  return (
    <div>
      <PopoverHeader
        icon={Users}
        label="Purchasing owner"
        hasSelection={params.purchasingOwners.length > 0}
        onClear={() => onChange({ ...params, purchasingOwners: [] })}
      />
      {showSearch && <ScopeSearch value={q} onChange={setQ} placeholder="Search owners…" />}
      {filtered.length > 1 && (
        <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
          <button
            type="button"
            onClick={toggleAll}
            className="text-primary hover:underline cursor-pointer"
            style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT }}
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
            {ql && ` (${filtered.length})`}
          </button>
        </div>
      )}
      <div className="max-h-[240px] overflow-y-auto py-1 px-1">
        {filtered.length === 0 ? (
          <EmptyRow>{ownerOptions.length === 0 ? "No owners" : "No matches"}</EmptyRow>
        ) : (
          filtered.map((o) => (
            <CheckOption
              key={o.value}
              checked={selectedSet.has(o.value)}
              count={o.count}
              onClick={() => onChange({ ...params, purchasingOwners: toggleValue(params.purchasingOwners, o.value) })}
            >
              {highlightMatch(o.isMe ? `${o.label} (You)` : o.label, q)}
            </CheckOption>
          ))
        )}
      </div>
      <PopoverFooterCount selected={params.purchasingOwners.length} total={ownerOptions.length} />
    </div>
  );
}

/* ─────────────────────────── CHIP ───────────────────────────
   Partners-style filter chip: "Icon Field · value ⌄" opens an edit popover;
   an optional trailing × removes the filter. The always-present Window chip
   passes removable={false}. `autoOpen` pops the editor right after a chip is
   added via "+ Filter". */
/* "Custom range" row inside the Window popover — clicking it opens a
   nested popover with the range Calendar + Cancel/Apply footer, matching
   the pattern used by the graph's day-marker editor (PlannerGapGraph.tsx)
   and the scope questionnaire's Custom pill. When the range is applied,
   the row shows the picked range as its label and stays highlighted; the
   parent Window popover closes so the chip's own `is Jul 5 – Aug 4` value
   text takes over. */
function CustomRangeOptionRow({
  params,
  onChange,
  isCustom,
  onCommit,
}: {
  params: ProcurementPlanningParams;
  onChange: (next: ProcurementPlanningParams) => void;
  isCustom: boolean;
  onCommit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isoToLocal = (iso?: string) => (iso ? new Date(iso + "T00:00:00") : undefined);
  const localToIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [pending, setPending] = useState<{ from?: Date; to?: Date } | undefined>({
    from: isoToLocal(params.customStart),
    to: isoToLocal(params.customEnd),
  });
  useEffect(() => {
    if (open) {
      setPending({ from: isoToLocal(params.customStart), to: isoToLocal(params.customEnd) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const label =
    isCustom && params.customStart && params.customEnd
      ? `${formatShort(params.customStart)} – ${formatShort(params.customEnd)}`
      : "Custom range";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-between w-full py-[7px] px-2.5 rounded-md cursor-pointer transition-colors hover:bg-muted/50 text-left"
          style={{ fontFamily: FONT }}
        >
          <span
            className="text-[13px]"
            style={{ fontWeight: isCustom ? 600 : 500, color: isCustom ? "#0A77FF" : "#475569" }}
          >
            {label}
          </span>
          {isCustom && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" sideOffset={6} className="w-auto p-0 z-[70]">
        <div className="border-b border-border px-3 py-2">
          <p className="text-[13px]" style={{ fontFamily: FONT, fontWeight: 600, color: "hsl(var(--foreground))" }}>
            Custom date range
          </p>
          <p className="text-[11.5px]" style={{ fontFamily: FONT, color: "hsl(var(--muted-foreground))" }}>
            {pending?.from && !pending?.to ? "Pick the end date" : "Pick a start date, then an end date"}
          </p>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          showOutsideDays={false}
          selected={pending}
          defaultMonth={pending?.from ?? new Date()}
          onSelect={(range) => setPending(range)}
          disabled={[{ before: new Date(todayISO() + "T00:00:00") }]}
          initialFocus
        />
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          <span className="text-[11.5px] tabular-nums" style={{ fontFamily: FONT, color: "hsl(var(--muted-foreground))" }}>
            {pending?.from && pending?.to
              ? `${formatShort(pending.from.toISOString().slice(0, 10))} – ${formatShort(pending.to.toISOString().slice(0, 10))}`
              : pending?.from
                ? `${formatShort(pending.from.toISOString().slice(0, 10))} – …`
                : "No range selected"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] transition-colors hover:bg-[hsl(var(--secondary))]"
              style={{ fontFamily: FONT, fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pending?.from || !pending?.to}
              onClick={() => {
                if (!pending?.from || !pending?.to) return;
                const fromIso = localToIso(pending.from);
                const toIso = localToIso(pending.to);
                onChange({
                  ...params,
                  customStart: fromIso,
                  customEnd: toIso,
                  horizonDays: daysFromTodayTo(toIso),
                });
                setOpen(false);
                onCommit();
              }}
              className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Partners-style filter chip — single-piece rounded pill (no split X-remove
   button — filters can only be RESET via the "Clear" link inside the
   dropdown; they can't be removed from the row). Two visual states:
     · Neutral (nothing selected): bg-card + slate border + muted label.
     · Active (values selected):    bg-primary/5 + primary/20 border + full
                                    label color, with the value summary
                                    appended inline ("Owner · is Areeb").
   Mirrors POFilterBar.MultiSelectChip's left button verbatim so the two
   surfaces read as one design system. `emphasized` is retained for legacy
   callers but is a no-op in this Partners treatment (hero and bar variants
   share the same 28-px pill). */
function ScopeChip({
  icon: Icon,
  label,
  valueText,
  active,
  autoOpen,
  onAutoOpened,
  width = 280,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  valueText?: string;
  active: boolean;
  /* Kept in the signature so DIMS wiring doesn't need to change; the
     Partners row never renders a remove button. */
  removable?: boolean;
  onRemove?: () => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
  width?: number;
  emphasized?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      onAutoOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);
  const hot = active;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-7 rounded-[var(--radius-sm)] border pl-2 pr-1.5 shrink-0 transition-all cursor-pointer ${
            hot
              ? "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/[0.08]"
              : "bg-card border-border text-foreground/60 hover:bg-secondary hover:text-foreground/80"
          }`}
          style={{ fontFamily: FONT }}
        >
          <Icon className="size-3 shrink-0 opacity-50" />
          <span style={{ fontSize: 12, fontWeight: 500, lineHeight: "16px" }}>{label}</span>
          {valueText && (
            <>
              <span
                className="text-foreground/35"
                style={{ fontSize: 12, fontWeight: 400, lineHeight: "16px" }}
              >
                ·
              </span>
              <span
                className="text-foreground/70 max-w-[160px] truncate"
                style={{ fontSize: 12, fontWeight: 400, lineHeight: "16px" }}
              >
                {valueText}
              </span>
            </>
          )}
          <ChevronDown className="size-2.5 opacity-40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 overflow-hidden rounded-[var(--radius)] border-border shadow-lg"
        align="start"
        sideOffset={6}
        style={{ width }}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/* "+ Filter" — dashed button opening a searchable list of the scope
   dimensions not yet on the bar (Partners ActiveFiltersBar pattern). */
function AddFilterButton({
  options,
  onAdd,
}: {
  options: { key: string; label: string; icon: ComponentType<{ className?: string }> }[];
  onAdd: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (options.length === 0) return null;
  const ql = q.trim().toLowerCase();
  const filtered = ql ? options.filter((o) => o.label.toLowerCase().includes(ql)) : options;
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-dashed text-[12px] cursor-pointer transition-colors hover:bg-muted/50 hover:text-foreground shrink-0"
          style={{ fontWeight: 600, color: "#64748B", borderColor: "hsl(var(--border))", fontFamily: FONT }}
        >
          <Plus className="size-3.5" />
          Filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[220px] p-0 rounded-lg shadow-lg border-border/80">
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search filters…"
              autoFocus
              className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-border outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/50"
              style={{ fontFamily: FONT, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
            />
          </div>
        </div>
        <div className="border-t border-border/50" />
        <div className="max-h-[260px] overflow-y-auto px-1.5 py-1">
          {filtered.length === 0 ? (
            <EmptyRow>No filters</EmptyRow>
          ) : (
            filtered.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => { onAdd(o.key); setOpen(false); setQ(""); }}
                className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50 text-left"
                style={{ fontFamily: FONT, color: "#334155", fontWeight: 500 }}
              >
                <o.icon className="size-3.5 shrink-0 text-[#64748B]" />
                {highlightMatch(o.label, q)}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── BAR ───────────────────────────
   Partners-style "active filters" bar: a persistent My-items toggle, the
   always-present Window chip, then dynamic Field·value chips the buyer adds
   via "+ Filter" (one per scope dimension) and removes via the chip's ×.
   Sits UNDER the search toolbar (PO/Partners parity). The full guided
   "Plan inventory" modal stays reachable from the toolbar Filters button. */

type ScopeDimKey = "sources" | "categories" | "issues" | "owners" | "acquisition";

const ACQUISITION_METHODS = ["Purchased", "Manufactured"] as const;

export function PlannerScopeBar({
  variant = "bar",
  applied = false,
  onApply,
  params,
  onChange,
  onOpenFilters,
  onConfigureCategories,
  categoriesList,
  categoryCodes,
  sourceCounts,
  categoryCounts,
  bandCounts,
  ownerOptions = [],
  acquisitionCounts = {},
  sandboxCount,
  onResumeSandbox,
  lastActiveItemLabel,
  meMode,
  meCount,
  onMeModeToggle,
}: {
  params: ProcurementPlanningParams;
  onChange: (next: ProcurementPlanningParams) => void;
  /** Layout mode. "bar" = the slim chip row (default). "hero" = the
      first-run welcome panel that stays on as a compact search header. */
  variant?: "bar" | "hero";
  /** Hero only: has the buyer applied the scope this load? Drives the
      prominent (welcome) ⇄ compact (header) states + the CTA visibility. */
  applied?: boolean;
  /** Hero only: the primary "Show my demand" CTA — gates the listing. */
  onApply?: () => void;
  /** Open the full "Plan inventory" modal — used by the hero's "More
      filters" button and (for parity) the toolbar Filters button. */
  onOpenFilters?: () => void;
  /** Open the standalone "Manage categories" modal from the category dropdown
      (Nophil/Eli #3 "Configure"). */
  onConfigureCategories?: () => void;
  categoriesList: string[];
  /** Display code per category name (C-2131, …); falls back to the name. */
  categoryCodes?: Record<string, string>;
  sourceCounts: Record<DemandSourceKind, number>;
  categoryCounts: Record<string, number>;
  bandCounts: Record<LevelBand, number>;
  /** Purchasing-owner picker options — name, "You" flag, faceted count. */
  ownerOptions?: { value: string; label: string; count: number; isMe: boolean }[];
  /** Faceted counts per acquisition method (Purchased / Manufactured). */
  acquisitionCounts?: Record<string, number>;
  /** Persistent "Sandbox (N)" resume button at the bar's far right — shown
      when the session has items; resumes (navigates into) the sandbox. */
  sandboxCount?: number;
  onResumeSandbox?: () => void;
  /** Optional short label (item code) of the most-recent item the buyer was
      planning on. When present, the resume button reads
      "Continue with <label> · N" so the buyer picks up exactly where they
      left off instead of the top-of-stack tab. */
  lastActiveItemLabel?: string | null;
  /** Me-mode toggle. When wired, the scope-bar prepends a "Me mode"
      pill on the far left of the chip row so buyers can filter to
      their own items alongside the scope dimensions. Sized to match
      the other chips exactly (h-7, 12/500 font) with a vertical
      divider between it and the Window chip. */
  meMode?: "all" | "me";
  meCount?: number;
  onMeModeToggle?: () => void;
}) {
  /* "No narrowing" — used to gate Clear all + the default-view banner.
     Compared against NO_NARROWING_PARAMS (empty owners/categories, no
     bands, all sources) rather than DEFAULT_PARAMS (which pre-selects
     me + owned categories), so the buyer can strip the pre-selection
     via Clear all if they want to see everything. */
  const isDefault = paramsEqual(params, NO_NARROWING_PARAMS);

  /* Dimensions added via "+ Filter" but not (yet) carrying a value — kept so
     their chip stays on the bar until removed, matching Partners. A chip is
     shown when its param is active OR it's been pinned here. */
  const [pinned, setPinned] = useState<Set<ScopeDimKey>>(new Set());
  const [autoOpenKey, setAutoOpenKey] = useState<ScopeDimKey | null>(null);

  /* Custom window active when an end date is set — mirrors the modal's
     `isCustom`, so the bar reflects whatever the buyer picked there. */
  const isCustom = !!params.customEnd;
  const horizonChanged = isCustom || params.horizonDays !== DEFAULT_PARAMS.horizonDays;
  const presetLabel =
    HORIZON_OPTIONS.find((o) => o.value === params.horizonDays)?.label ?? `${params.horizonDays} days`;
  /* Partners-phrased value hint — "is <label>" so the Window chip reads
     the same as the multi-select siblings. Never shows when the window is
     the default so the neutral chip has no dangling value chunk. */
  /* Chip trigger label mirrors the dropdown rows exactly — bare preset
     labels (`is 30 days`, `is 6 months`, `is All time`). Buyer feedback
     2026-07-13 dropped the "Next" prefix everywhere; "Planning period"
     already sets the forward-looking context. */
  const horizonText = !horizonChanged
    ? undefined
    : isCustom && params.customStart && params.customEnd
      ? `is ${formatShort(params.customStart)} – ${formatShort(params.customEnd)}`
      : `is ${presetLabel}`;

  const labelForCat = (c: string) => categoryCodes?.[c] ?? c;

  /* Per-dimension config: label, icon, is-active predicate, the value text
     for the chip, the param-clear, and the popover edit body. */
  const DIMS: {
    key: ScopeDimKey;
    label: string;
    icon: ComponentType<{ className?: string }>;
    width?: number;
    active: boolean;
    valueText: string;
    clear: () => void;
    body: (close: () => void) => ReactNode;
  }[] = [
    /* Purchasing owner — pinned first, taking the slot the retired
       Ownership (mineOnly) toggle used to occupy. `mineOnly` was removed
       from the row per feedback ("combine ownership and purchasing owner
       — ownership is not required, only purchasing owner will be fine").
       The default preselect of [MY_OWNER_NAME] on this filter carries the
       "just me" narrowing that Ownership used to give. */
    {
      key: "owners",
      label: "Purchasing owner",
      icon: Users,
      width: 280,
      /* Only counts as "active" (narrowing) when it isn't the equivalent of
         "everyone" — i.e. neither empty nor a superset of the full owner
         list. Reads honestly: "just me" or "N specific owners" is active;
         "all owners selected" is not. */
      active:
        params.purchasingOwners.length > 0 &&
        params.purchasingOwners.length < ownerOptions.length,
      valueText: (() => {
        const sel = params.purchasingOwners;
        /* Neutral chip (no value chunk) both when nothing is picked and when
           everyone is picked — both mean "no narrowing." Middle-state
           phrasing: "is <name>" (with a (You) tag for the logged-in
           buyer) or "N selected" for multi. */
        if (sel.length === 0) return undefined;
        if (sel.length >= ownerOptions.length && ownerOptions.length > 0) return undefined;
        if (sel.length === 1) {
          const o = ownerOptions.find((x) => x.value === sel[0]);
          const name = o ? (o.isMe ? `${o.label} (You)` : o.label) : sel[0];
          return `is ${name}`;
        }
        return `${sel.length} selected`;
      })(),
      clear: () => onChange({ ...params, purchasingOwners: [] }),
      body: () => <OwnerBody params={params} onChange={onChange} ownerOptions={ownerOptions} />,
    },
    {
      key: "sources",
      label: "Sources",
      icon: FileText,
      active: params.sources.length > 0,
      valueText: valueSummary(
        params.sources.length,
        params.sources.length === 1
          ? SOURCE_META.find((m) => m.value === params.sources[0])?.label ?? null
          : null,
      ),
      clear: () => onChange({ ...params, sources: [] }),
      body: () => {
        /* Select all / Deselect all — consistency with Owner popover
           (buyer 2026-07-16: sources will grow over time, needs the
           same bulk-toggle affordance). */
        const allSourceValues = SOURCE_META.map((m) => m.value);
        const selectedSourceSet = new Set(params.sources);
        const allSourcesSelected =
          allSourceValues.length > 0 &&
          allSourceValues.every((v) => selectedSourceSet.has(v));
        const toggleAllSources = () => {
          if (allSourcesSelected) {
            onChange({ ...params, sources: [] });
          } else {
            onChange({ ...params, sources: [...allSourceValues] });
          }
        };
        return (
        <div>
          <PopoverHeader
            icon={FileText}
            label="Demand source"
            hasSelection={params.sources.length > 0}
            onClear={() => onChange({ ...params, sources: [] })}
          />
          {/* Copy fix (Eli 2026-07-09): make optional-ness explicit. */}
          <div
            className="px-3 pt-1.5 pb-2 text-foreground/55"
            style={{ fontSize: 11, lineHeight: "15px", fontFamily: FONT }}
          >
            All sources are included by default. Select one to focus the list.
          </div>
          {SOURCE_META.length > 1 && (
            <div className="flex items-center justify-between px-3 pt-0.5 pb-1">
              <button
                type="button"
                onClick={toggleAllSources}
                className="text-primary hover:underline cursor-pointer"
                style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT }}
              >
                {allSourcesSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
          )}
          <div className="py-1 px-1">
            {SOURCE_META.map(({ value, label, Icon, explain }) => (
              <CheckOption
                key={value}
                checked={params.sources.includes(value)}
                count={sourceCounts[value] ?? 0}
                icon={Icon}
                title={explain}
                onClick={() => onChange({ ...params, sources: toggleValue(params.sources, value) })}
              >
                {label}
              </CheckOption>
            ))}
          </div>
          <PopoverFooterCount selected={params.sources.length} total={SOURCE_META.length} />
        </div>
        );
      },
    },
    {
      key: "categories",
      label: "Category",
      icon: Layers,
      active: params.categories.length > 0,
      valueText: valueSummary(
        params.categories.length,
        params.categories.length === 1 ? labelForCat(params.categories[0]) : null,
      ),
      clear: () => onChange({ ...params, categories: [] }),
      body: (close) => (
        <CategoryBody
          params={params}
          onChange={onChange}
          categoriesList={categoriesList}
          categoryCodes={categoryCodes}
          categoryCounts={categoryCounts}
          onConfigure={onConfigureCategories ? () => { close(); onConfigureCategories(); } : undefined}
        />
      ),
    },
    {
      key: "issues",
      label: "Issues",
      icon: ShieldAlert,
      active: params.bands.length > 0,
      valueText: valueSummary(
        params.bands.length,
        params.bands.length === 1 ? bandLabel(params.bands[0]) : null,
      ),
      clear: () => onChange({ ...params, bands: [], overstockThreshold: null }),
      body: () => {
        const aboveMaxActive = params.bands.includes("above-max");
        const thr = params.overstockThreshold ?? null;
        const thrMode: OverstockThreshold["mode"] = thr?.mode ?? "any";
        return (
          <div>
            <PopoverHeader
              icon={ShieldAlert}
              label="Issues"
              hasSelection={params.bands.length > 0}
              onClear={() =>
                onChange({ ...params, bands: [], overstockThreshold: null })
              }
            />
            {/* Copy fix (Eli 2026-07-09): read as a filter. */}
            <div
              className="px-3 pt-1.5 pb-2 text-foreground/55"
              style={{ fontSize: 11, lineHeight: "15px", fontFamily: FONT }}
            >
              Filter for items that have fallen below max / min / zero, or gone above max.
            </div>
            <div className="py-1 px-1">
              {LEVEL_BANDS_BY_SEVERITY.map((b) => (
                <CheckOption
                  key={b}
                  checked={params.bands.includes(b)}
                  count={bandCounts[b] ?? 0}
                  dot={BAND_TONE[b].dot}
                  onClick={() => {
                    const nextBands = toggleValue(params.bands, b);
                    /* When above-max is being toggled OFF, clear its
                       threshold too so the input doesn't linger. */
                    const nextThr =
                      b === "above-max" && !nextBands.includes("above-max")
                        ? null
                        : params.overstockThreshold ?? null;
                    onChange({ ...params, bands: nextBands, overstockThreshold: nextThr });
                  }}
                >
                  {bandLabel(b)}
                </CheckOption>
              ))}
            </div>
            {/* Overstock threshold — only shown when above-max is
                active. Nophil 2026-07-14: "10,000 screws over max =
                rounding error; 10 cars over max = a million dollars",
                so buyers refine by percent or absolute qty. */}
            {aboveMaxActive && (
              <div className="border-t border-border/60 px-3 py-2.5">
                <div
                  className="mb-1.5 text-foreground/60"
                  style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
                >
                  How far above max
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {(
                    [
                      { mode: "any" as const, label: "Any" },
                      { mode: "pct" as const, label: "% over" },
                      { mode: "qty" as const, label: "Units over" },
                    ] as const
                  ).map((opt) => {
                    const active = thrMode === opt.mode;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => {
                          if (opt.mode === "any") {
                            onChange({ ...params, overstockThreshold: null });
                          } else {
                            const value = thr?.mode === opt.mode
                              ? thr.value
                              : opt.mode === "pct"
                                ? DEFAULT_OVERSTOCK_THRESHOLD.value
                                : 0;
                            onChange({ ...params, overstockThreshold: { mode: opt.mode, value } });
                          }
                        }}
                        className="inline-flex h-6 items-center rounded-md border px-2 transition-colors cursor-pointer"
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          fontFamily: FONT,
                          borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
                          backgroundColor: active ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
                          color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {thrMode !== "any" && (
                  <OverstockThresholdInput
                    mode={thrMode}
                    value={thr?.value ?? 0}
                    onChange={(value) =>
                      onChange({ ...params, overstockThreshold: { mode: thrMode, value } })
                    }
                  />
                )}
              </div>
            )}
            {/* "Include items without issues" toggle (Eli 2026-07-09):
                Nophil's seasonal-buyer scenario — plan/sandbox items
                that aren't triggered today. Default off so the listing
                stays actionable; buyers who need broader planning flip
                it on and see healthy items too. */}
            <div className="border-t border-border/60 px-3 py-2.5">
              <label
                className="flex items-center gap-2 cursor-pointer"
                style={{ fontFamily: FONT }}
              >
                <input
                  type="checkbox"
                  checked={!!params.includeItemsWithoutIssues}
                  onChange={(e) =>
                    onChange({
                      ...params,
                      includeItemsWithoutIssues: e.target.checked,
                    })
                  }
                  className="h-3.5 w-3.5 cursor-pointer accent-[hsl(var(--primary))]"
                />
                <span className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
                  Include items without issues
                </span>
              </label>
              <div
                className="ml-5 mt-0.5 text-foreground/55"
                style={{ fontSize: 10.5, lineHeight: "14px" }}
              >
                Show healthy items too, so you can plan or sandbox anything (not just triggered items).
              </div>
            </div>
            <PopoverFooterCount selected={params.bands.length} total={LEVEL_BANDS_BY_SEVERITY.length} />
          </div>
        );
      },
    },
    {
      key: "acquisition",
      label: "Acquisition",
      icon: Boxes,
      active: params.acquisitionMethods.length > 0,
      valueText: valueSummary(
        params.acquisitionMethods.length,
        params.acquisitionMethods.length === 1 ? params.acquisitionMethods[0] : null,
      ),
      clear: () => onChange({ ...params, acquisitionMethods: [] }),
      body: () => (
        <div>
          <PopoverHeader
            icon={Boxes}
            label="Acquisition method"
            hasSelection={params.acquisitionMethods.length > 0}
            onClear={() => onChange({ ...params, acquisitionMethods: [] })}
          />
          {/* Copy fix (Eli 2026-07-09): everything on the planner is
              purchased; the filter is about PRIMARY method. */}
          <div
            className="px-3 pt-1.5 pb-2 text-foreground/55"
            style={{ fontSize: 11, lineHeight: "15px", fontFamily: FONT }}
          >
            Select whether items are purchased or manufactured.
          </div>
          <div className="py-1 px-1">
            {ACQUISITION_METHODS.map((m) => (
              <CheckOption
                key={m}
                checked={params.acquisitionMethods.includes(m)}
                count={acquisitionCounts[m] ?? 0}
                onClick={() => onChange({ ...params, acquisitionMethods: toggleValue(params.acquisitionMethods, m) })}
              >
                {m}
              </CheckOption>
            ))}
          </div>
          <PopoverFooterCount selected={params.acquisitionMethods.length} total={ACQUISITION_METHODS.length} />
        </div>
      ),
    },
  ];

  const shownDims = DIMS.filter((d) => d.active || pinned.has(d.key));
  const addable = DIMS.filter((d) => !d.active && !pinned.has(d.key)).map((d) => ({
    key: d.key,
    label: d.label,
    icon: d.icon,
  }));

  const addDim = (key: string) => {
    setPinned((s) => new Set(s).add(key as ScopeDimKey));
    setAutoOpenKey(key as ScopeDimKey);
  };
  const removeDim = (d: (typeof DIMS)[number]) => {
    setPinned((s) => {
      const n = new Set(s);
      n.delete(d.key);
      return n;
    });
    d.clear();
  };

  /* ── Shared control fragments — composed by both the slim "bar" and the
     "hero" header so the two surfaces stay identical chip-for-chip. ── */

  /* "Me mode" quick lens — flips params.mineOnly (scopes to items the buyer
     owns). Styled to match Partners' Me-mode pill so the two products share
     the same shape / colour vocabulary. `emphasized` bumps the pill up a size
     for the hero header so it visually balances the taller filter chips. */
  /* Ownership pill — Partners chip dimensions, but a one-click toggle
     (mineOnly is boolean; a popover here would be worse UX). Value hint
     mirrors the multi-select siblings: "is me" when narrowed, empty
     otherwise so the chip settles into the same neutral state the other
     chips use at rest. `emphasized` retained for legacy callers, no-op in
     Partners look. */
  const renderMyItemsButton = (_emphasized = false) => (
    <button
      type="button"
      onClick={() => onChange({ ...params, mineOnly: !params.mineOnly })}
      aria-pressed={params.mineOnly}
      title="Show only items you own"
      className={`inline-flex items-center gap-1.5 h-7 rounded-[var(--radius-sm)] border pl-2 pr-2.5 shrink-0 transition-all cursor-pointer whitespace-nowrap ${
        params.mineOnly
          ? "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/[0.08]"
          : "bg-card border-border text-foreground/60 hover:bg-secondary hover:text-foreground/80"
      }`}
      style={{ fontFamily: FONT }}
    >
      <User className="size-3 shrink-0 opacity-50" />
      <span style={{ fontSize: 12, fontWeight: 500, lineHeight: "16px" }}>Ownership</span>
      {params.mineOnly && (
        <>
          <span
            className="text-foreground/35"
            style={{ fontSize: 12, fontWeight: 400, lineHeight: "16px" }}
          >
            ·
          </span>
          <span
            className="text-foreground/70"
            style={{ fontSize: 12, fontWeight: 400, lineHeight: "16px" }}
          >
            is me
          </span>
        </>
      )}
    </button>
  );

  /* Window — always present, editable, not removable (planning always needs a
     time window). An essential, in both layouts. `emphasized` gives the hero
     header a scaled-up card treatment. */
  const renderWindowChip = (emphasized = false) => (
    <ScopeChip
      icon={Clock}
      label="Planning period"
      valueText={horizonText}
      active={horizonChanged}
      removable={false}
      emphasized={emphasized}
      width={264}
    >
      {(close) => (
        <div>
          <PopoverHeader
            icon={Clock}
            label="Planning period"
            hasSelection={horizonChanged}
            onClear={() =>
              onChange({
                ...params,
                horizonDays: DEFAULT_PARAMS.horizonDays,
                customStart: undefined,
                customEnd: undefined,
              })
            }
          />
          <div className="py-1 px-1">
            {HORIZON_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                on={!isCustom && params.horizonDays === o.value}
                onClick={() => {
                  onChange({ ...params, horizonDays: o.value, customStart: undefined, customEnd: undefined });
                  close();
                }}
              >
                {o.label}
              </OptionRow>
            ))}
            <CustomRangeOptionRow
              params={params}
              onChange={onChange}
              isCustom={isCustom}
              onCommit={close}
            />
          </div>
        </div>
      )}
    </ScopeChip>
  );

  /* "Clear all" — resets the scope to defaults; only shown once narrowed. */
  const clearAllButton = !isDefault ? (
    <button
      type="button"
      onClick={() => {
        onChange(NO_NARROWING_PARAMS);
        setPinned(new Set());
      }}
      className="inline-flex items-center gap-1 h-8 px-2 rounded-md text-[12px] cursor-pointer transition-colors shrink-0"
      style={{ fontWeight: 500, color: "#64748B" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "#64748B"; }}
    >
      <RotateCcw className="size-3" />
      Clear all
    </button>
  ) : null;

  /* Persistent "Open sandbox (N)" resume button — pushed to the far right
     (ml-auto), shown whenever the planning session has items. The bulk-
     selection bar carries its own "Sandbox these items (N)" action for
     multi-select flows, so this button only handles resume. */
  const sandboxButton = onResumeSandbox && (sandboxCount ?? 0) > 0 ? (
    <Button
      size="sm"
      onClick={onResumeSandbox}
      className="ml-auto h-9 gap-2 px-3 rounded-lg shrink-0 bg-[#0a77ff] hover:bg-[#0866dd] text-white shadow-sm"
      style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13 }}
      title={
        lastActiveItemLabel
          ? `Open sandbox — resumes with ${lastActiveItemLabel}`
          : "Open sandbox"
      }
    >
      <FlaskConical className="size-3.5" />
      <span className="whitespace-nowrap">Open sandbox</span>
      <span
        className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5"
        style={{ fontSize: "11px", fontWeight: 700, fontFamily: FONT, backgroundColor: "rgba(255,255,255,0.25)", color: "white" }}
      >
        {sandboxCount}
      </span>
    </Button>
  ) : null;

  /* ─────────────────────────── HERO HEADER ───────────────────────────
     The first-run welcome panel (replaces the old first-run modal). Every
     scope dimension — Sources · Categories · Issues · Purchasing owner ·
     Acquisition — is rendered inline alongside My items · Window as an
     always-present, non-removable chip (parity with Sources/Window), so no
     filter is hidden behind a "More filters" modal. Prominent + tinted with a
     "Show my demand" CTA until applied; afterwards it stays on as a compact
     search header. */
  if (variant === "hero") {
    return (
      <div
        className="border-b"
        data-procurement-planning-scope-bar
        style={{
          borderColor: "hsl(var(--border))",
          fontFamily: FONT,
          background: applied
            ? undefined
            : "linear-gradient(180deg, hsl(var(--primary-tint)) 0%, hsl(var(--card)) 92%)",
        }}
      >
        {!applied && (
          <div className="flex items-start gap-3.5 px-4 pt-5 pb-3.5">
            <div
              className="flex items-center justify-center size-10 rounded-xl shrink-0"
              style={{ backgroundColor: "rgba(10,119,255,0.14)", color: "#0A77FF" }}
            >
              <SlidersHorizontal className="size-[20px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[17px] leading-tight" style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>
                Plan your inventory
              </div>
              <div className="text-[13px] mt-1" style={{ color: "#475569" }}>
                Pick a planning period and sources, then show your demand. Every filter is available inline.
              </div>
            </div>
            {onApply && (
              <Button
                onClick={onApply}
                className="ml-auto shrink-0 h-10 gap-2 px-4 rounded-lg bg-[#0a77ff] hover:bg-[#0866dd] text-white shadow-sm"
                style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5 }}
              >
                <Search className="size-4" />
                Show demand
              </Button>
            )}
          </div>
        )}
        <div className={`px-4 flex items-center gap-2.5 flex-wrap ${applied ? "py-3" : "pb-3.5"}`}>
          {/* Me mode pill — fully rounded, sized to sit alongside the
              ScopeChip row (h-7, 12/500 font). Renders on the far-left
              with a vertical divider separating it from the Window
              chip so it reads as its own control cluster. */}
          {onMeModeToggle && (
            <>
              <button
                type="button"
                onClick={onMeModeToggle}
                className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-3 shrink-0 transition-all cursor-pointer ${
                  meMode === "me"
                    ? "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/[0.08]"
                    : "bg-card border-border text-foreground/60 hover:bg-secondary hover:text-foreground/80"
                }`}
                style={{ fontFamily: FONT }}
              >
                <User className="size-3 shrink-0 opacity-50" />
                <span style={{ fontSize: 12, fontWeight: 500, lineHeight: "16px" }}>
                  Me mode
                </span>
              </button>
              <div
                className="w-px h-5 bg-border/60 shrink-0"
                aria-hidden
              />
            </>
          )}
          {/* Ownership (mineOnly) chip retired — its role merged into
              Purchasing owner (first DIM), which defaults to [MY_OWNER_NAME]
              for the "just me" narrowing that the toggle used to give. */}
          {renderWindowChip(true)}
          {/* Applied state: instead of surfacing every dimension as its own
              popover chip (5-chip forest that duplicated the Filters modal),
              collapse to a single summary + a prominent Filters button.
              Individual dimension edits live inside the modal now — one
              surface, one source of truth. First-run keeps the full chip
              treatment (else branch) so buyers still see every filter
              during scope setup. */}
          {/* Every scope dimension surfaces as its own popover chip — Sources
              · Categories · Issues · Purchasing owner · Acquisition. Matches
              the first-run treatment so applied and unapplied states are
              visually consistent. The collapsed "Filters" summary + button
              was removed per feedback: buyers prefer seeing every dimension
              at a glance rather than opening a modal to inspect one. */}
          {DIMS.map((d) => (
            <ScopeChip
              key={d.key}
              icon={d.icon}
              label={d.label}
              valueText={d.active ? d.valueText : undefined}
              active={d.active}
              removable={false}
              emphasized
              width={d.width}
            >
              {d.body}
            </ScopeChip>
          ))}
          {clearAllButton}
          {sandboxButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-2.5 border-b flex items-center gap-2 flex-wrap"
      style={{ borderColor: "hsl(var(--border))", fontFamily: FONT }}
      data-procurement-planning-scope-bar
    >
      {/* Ownership chip retired — merged into Purchasing owner (first DIM). */}
      {renderWindowChip()}

      {/* Every dimension is pinned — no + Add filter / X-remove logic. Clear
          inside a chip's dropdown resets that dimension's values but the
          chip stays on the row (Partners-style, per feedback). */}
      {DIMS.map((d) => (
        <ScopeChip
          key={d.key}
          icon={d.icon}
          label={d.label}
          valueText={d.active ? d.valueText : undefined}
          active={d.active}
          width={d.width}
        >
          {d.body}
        </ScopeChip>
      ))}

      {clearAllButton}
      {sandboxButton}
    </div>
  );
}
