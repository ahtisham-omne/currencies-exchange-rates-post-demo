/* ═══════════════════════════════════════════════════════════════
   Unified Transaction Stream — Phase 3
   ───────────────────────────────────────────────────────────────
   Eli's E5/E6/E7 directive: the demand and future-incoming streams
   are one chronological sequence, not two tabs. This component
   merges PlannerDemandEvent + FutureIncomingEvent into a single
   date-ordered list with direction iconography (incoming /
   outgoing) and sliceable filters (by direction, by timeframe).
   Designed for hundreds of rows — vertical scroll owned by this
   component, sticky header on the inner table.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  MoreHorizontal,
  Package as PackageIcon,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X as XIcon,
} from "lucide-react";

import { FONT } from "./designTokens";
import { Input } from "./ui/input";
import { Calendar } from "./ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import type {
  FutureIncomingEvent,
  PlannerDemandEvent,
  PlannerItem,
  PlannerVendor,
} from "./plannerData";
import { sourceDocHref } from "./plannerData";
import { SHOW_PURCHASE_REQUESTS_IN_PLANNER } from "./procurementPlanningParams";
import { getCompatibleUOMs, convertQty } from "./uomRegistry";
import { SystemDatePicker } from "./_dashboardModalKit";
import type { PurchaseOrderData } from "./poStore";
import PlannerAddChooser from "./PlannerAddChooser";
import PlannerTransactionTable from "./PlannerTransactionTable";
import { enrichTransactions } from "./plannerTxEnrich";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

/* ─────────────────────────── PUBLIC TYPES ─────────────────────────── */

export type TransactionDirection = "incoming" | "outgoing";
export type TransactionTimeframe = 30 | 60 | 90 | "all";

/** Sandbox-only adjustment applied to a real transaction. Both kinds drop
    the transaction out of the enhanced curve; the visual distinction
    communicates intent — `excluded` says "won't happen", `flagged` says
    "might not happen". The row stays visible in the stream so the buyer
    can revert. */
export type TransactionAdjustment = "excluded" | "flagged";

/** Phantom demand event injected via the Sandbox "Inject hypothetical"
    affordance. The Sandbox host owns the array; the stream renders these
    inline alongside real transactions with a violet PHANTOM eyebrow. */
export interface PhantomDemandTransaction {
  id: string;
  qty: number;
  /** ISO yyyy-mm-dd. */
  requiredDate: string;
  reason?: string;
}

/** A simulated what-if transaction added via the Transaction Table header's
    "Simulate entry" button. `qty` is a positive magnitude; `direction`
    carries the sign. Host-owned (the planner workspace) so the button can
    live in the section header, outside the table body. */
export interface SimulatedTxn {
  id: string;
  direction: TransactionDirection;
  /** Internal type label (maps via TYPE_DISPLAY): "SO" | "Purchase Request"
      | "Planned demand" | "PO". */
  typeLabel: string;
  reference: string;
  qty: number;
  /** ISO yyyy-mm-dd. */
  date: string;
}

/** A proposed/allocated vendor PO the buyer has planned on the graph or vendor
    panel. Rendered as an incoming row with a blue PLANNED badge so the
    Transaction Table mirrors the gap graph's *enhanced* curve exactly — every
    bump in projected stock has a row that explains it. Host-owned (the
    workspace derives these from the proposed POs); managed there, not here. */
export interface PlannedIncomingTxn {
  id: string;
  /** Vendor placing the planned PO — shown as the row's counterparty. */
  vendorName: string;
  qty: number;
  /** ISO yyyy-mm-dd — the planned arrival/receiving day (where the curve lifts). */
  expectedDate: string;
  /** ISO yyyy-mm-dd — the day the order must be PLACED (arrival − lead time).
      The gap graph draws this as the hollow "Planned PO" diamond linked to the
      receiving dot; the table surfaces it in the "Order by" column so both
      views show the same two dates. */
  orderDate?: string;
}

interface UnifiedTransaction {
  id: string;
  direction: TransactionDirection;
  /** ISO yyyy-mm-dd. */
  date: string;
  daysFromToday: number;
  /** Signed: +N for incoming, −N for outgoing. */
  qty: number;
  /** Display label for the type pill — "SO" / "Purchase Request" / "PO" /
      "Planned demand". */
  typeLabel: string;
  /** Document reference — SO number / PO-{n}. */
  reference: string;
  /** Planned vendor POs only: ISO yyyy-mm-dd the order must be placed (arrival −
      lead time). Surfaced in the "Order by" column so the table shows the same
      two dates the gap graph's diamond→dot connector does. */
  orderDate?: string;
  /** Other party — customer / vendor / requester. */
  partyLabel?: string;
  /** Lifecycle state to render as a pill — only when known. */
  state?: string;
  /** Demand priority — only set for outgoing demand events. */
  priority?: string;
  /** Free-text "why" — surfaced as a small italic line under the
      reference/party row. Mostly set on Request and LowStock events. */
  reason?: string;
  /** True when this transaction is a Sandbox phantom (proposed PO or
      injected demand). Drives the violet PHANTOM eyebrow + "Remove"
      action. */
  isPhantom?: boolean;
  /** True when this is a predicted "what-if" transaction the buyer mocked
      onto the Timeline canvas. Real shape (SO/PO), but tagged so the ledger
      shows a violet PREDICTED eyebrow + wash and the balance reflects the
      scenario. Managed (added / removed) from the Timeline, not here. */
  isPredicted?: boolean;
  /** True when this is a locally simulated what-if added via the stream's own
      "Simulate entry" affordance (not host-owned). Renders a violet SIMULATED
      eyebrow + wash and is removable inline. */
  isSimulated?: boolean;
  /** True when this is a planned vendor PO (a buyer allocation mirrored from
      the gap graph). Renders a blue PLANNED badge + wash; managed from the
      vendor panel / graph, so it carries no inline action here. */
  isPlanned?: boolean;
  /** Active adjustment — only set for real transactions the buyer has
      excluded or flagged in the Sandbox. */
  adjustment?: TransactionAdjustment;
}

/* ─────────────────────────── TONES ─────────────────────────── */

/* Buyer-facing Type vocabulary — maps internal source labels to the
   words the planning team uses. (Low-stock reorder signals are no longer
   surfaced as rows — they aren't plotted on the gap graph either — so the
   map carries no "Low Stock" entry.) */
const TYPE_DISPLAY: Record<string, string> = {
  SO: "Sales order",
  "Purchase Request": "Purchase request",
  /* Eli 2026-07-09: spell "Purchase order" out to match "Sales order".
     Consistency is the goal — don't abbreviate one and not the other. */
  PO: "Purchase order",
  "Planned demand": "Planned demand",
};

/* ── Type-pill palette — MIRRORS PlannerGapGraph's DOT_TONE so a pill means the
   SAME thing on the graph and in the table (the buyer asked for identical pills
   across both surfaces). Same fills, same labels, same dot treatment: a planned
   PO is ringed (proposed), a draft PO is a hollow dashed dot, everything else is
   a solid dot. Text is slate (#334155) on a 12%-tint of the fill, exactly like
   the graph's colour-key chips. */
type GraphDot = "so" | "pr" | "incoming" | "draft" | "proposed";
const GRAPH_DOT: Record<GraphDot, { fill: string; label: string }> = {
  so: { fill: "#DC2626", label: "Sales order" },
  pr: { fill: "#EA580C", label: "Purchase request" },
  /* Eli 2026-07-09: spell out consistently with "Sales order". */
  incoming: { fill: "#059669", label: "Purchase order" },
  draft: { fill: "#059669", label: "Draft purchase order" },
  proposed: { fill: "#2563EB", label: "Planned purchase order" },
};
/* Map a row to the graph's dot taxonomy (the same mapping PlannerGapGraph's
   `dotTypeOf` makes for an event). Returns null for row kinds the graph doesn't
   plot as one of the five dots (a forecasted "Planned demand" line) — those fall
   back to a neutral slate pill. */
function graphDotFor(t: UnifiedTransaction): GraphDot | null {
  if (t.isPlanned) return "proposed";
  switch (t.typeLabel) {
    case "SO":
      return "so";
    case "Purchase Request":
      return "pr";
    case "PO":
      return t.state === "Draft" ? "draft" : "incoming";
    default:
      return null;
  }
}

/* Event colour per transaction type — mirrors the gap graph's dot palette
   (SO red · PR orange · receiving/PO green · planned blue) so the graph-hover
   cross-highlight tints each matching row in its own event colour. */
function eventColorFor(typeLabel: string, direction: string): string {
  switch (typeLabel) {
    case "SO":
      return "#DC2626";
    case "Purchase Request":
      return "#EA580C";
    case "PO":
      return "#059669";
    case "Planned demand":
      return "#2563EB";
    default:
      return direction === "incoming" ? "#059669" : "#DC2626";
  }
}

/** Adjustment-row tone — separate from the type pill so a flagged SO
    still reads as an SO while the row itself carries the warning. */
const ADJUSTMENT_TONE: Record<TransactionAdjustment, { fg: string; bg: string; bd: string; label: string }> = {
  excluded: { fg: "#475569", bg: "#F1F5F9", bd: "#CBD5E1", label: "Excluded" },
  flagged: { fg: "#C2410C", bg: "#FFF6E9", bd: "#FED7AA", label: "Flagged" },
};

/* State pills used to live in a hand-curated tone map, but the map only
   covered a subset of the real state values (DemandEventState +
   POStatus). Rows whose state wasn't in the map rendered with NO pill
   at all — e.g. PO incoming with status "Draft" / "Fully Received" /
   "Cancelled" lost its state pill silently.

   Since every pill is now the same neutral palette anyway, the lookup
   is gone — we render whatever real state string the upstream type
   produces. Real states today:
     · DemandEventState — "Pending Approval" / "Confirmed" /
       "Partially Shipped"
     · POStatus — "Draft" / "Sent" / "Confirmed" / "Partially Received"
       / "Fully Received" / "Cancelled" / "Active with Cancellations" /
       "Fully Received with Cancellations" */

/* ─────────────────────────── HELPERS ─────────────────────────── */

function todayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Today as a local-midnight ISO date — seeds the header "Add" chooser. */
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Day offset (0 = today, clamped ≥ 0) for an ISO date — the vendor-plot anchor. */
function dayFromIso(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.round((ms - todayMs()) / 86400000));
}

function fmtDate(iso: string): string {
  /* "Jul 7, 2026" — month, day AND year. Parsed from local Y/M/D parts (NOT
     `new Date(iso)`, which treats a date-only string as UTC and can shift a day
     behind UTC). */
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* Plain-English summary for the Description column — what the row IS, in the
   planning team's words, including the counterparty + any free-text reason.
   Distinct from Type (the short pill) and Source (the document reference). */
function describeTransaction(t: UnifiedTransaction): string {
  const party = t.partyLabel?.trim();
  const reason = t.reason?.trim();
  let base: string;
  if (t.isSimulated) base = `Simulated ${t.direction === "incoming" ? "supply" : "demand"}`;
  else if (t.isPredicted) base = `Predicted ${t.direction === "incoming" ? "supply" : "demand"}`;
  else if (t.isPlanned) base = party ? `Planned purchase from ${party}` : "Planned purchase order";
  else if (t.typeLabel === "PO") base = party ? `Incoming delivery from ${party}` : "Incoming delivery";
  else if (t.typeLabel === "SO") base = party ? `Sales order for ${party}` : "Sales order";
  else if (t.typeLabel === "Purchase Request")
    base = party ? `Purchase request for ${party}` : "Purchase request";
  else base = TYPE_DISPLAY[t.typeLabel] ?? t.typeLabel;
  return reason && !base.toLowerCase().includes(reason.toLowerCase()) ? `${base} · ${reason}` : base;
}

/* Infinite scroll — render this many rows up front, then grow by LOAD_MORE
   each time the bottom sentinel scrolls into view (replaces the old pager). */
const INITIAL_ROWS = 10;
const LOAD_MORE = 10;

/* Horizontal cell padding for the ledger table. Scales with the UI scale
   (`--gs`) exactly like the fonts and column widths, so the column gutters
   grow on 2K/4K instead of staying a cramped 12px while everything else gets
   bigger. Applied as an inline style (this file's gs-scaling idiom) so it
   reaches the standalone TxRow / CrossingAnnotation rows via the inherited var. */
const CELL_PX = "calc(14px * var(--gs, 1))";
const CELL_PAD_STYLE: React.CSSProperties = { paddingLeft: CELL_PX, paddingRight: CELL_PX };

/* Running projected-on-hand, two-digit zero-padded so the column reads as a
   tidy ledger (4 → "04", −6 → "-06"). */
function fmtStock(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? "-" : "") + String(Math.abs(r)).padStart(2, "0");
}

/* A node "moves" inventory only if it's a firm demand / incoming / planned /
   simulated line. Reorder-point signals (Low Stock), draft SOs and adjusted
   rows flag a condition but don't change the running balance — they carry it
   forward and read muted. */
function isMovement(t: UnifiedTransaction): boolean {
  return !t.adjustment && t.state !== "Draft" && t.typeLabel !== "Low Stock";
}

/* ─────────────────────────── GUARDRAIL BANDS ───────────────────────────
   The running projected-on-hand sits in one of four bands relative to the
   item's min / max levels. Ranked worst → best so a row-to-row change tells
   us whether stock is deteriorating (crossing a guardrail downward) or
   recovering (climbing back up). Colour-trained to the gap graph's threshold
   call-outs: max = slate, min = amber, zero = red; any recovery reads green. */
type StockBand = "healthy" | "belowMax" | "belowMin" | "belowZero";
const BAND_RANK: Record<StockBand, number> = {
  healthy: 0,
  belowMax: 1,
  belowMin: 2,
  belowZero: 3,
};
function bandOf(value: number, minLevel: number, maxLevel: number): StockBand {
  if (value < 0) return "belowZero";
  if (value < minLevel) return "belowMin";
  if (value < maxLevel) return "belowMax";
  return "healthy";
}
/* Down-crossing colours mirror PlannerGapGraph's threshold-breach call-outs
   (max slate · min amber · zero red); recovery is the graph's positive green. */
const DROP_TONE: Record<Exclude<StockBand, "healthy">, string> = {
  belowMax: "#64748B",
  belowMin: "#D97706",
  belowZero: "#DC2626",
};
const RECOVER_TONE = "#15803D";

/* The continuous stock line carries three states: green while on track
   (≥ min), amber once below minimum, red below zero. (The slate "below
   maximum" band still drives an inline chip, but the spine keeps to three so
   it reads at a glance — matches the timeline legend.) */
function lineTone(band: StockBand): string {
  return band === "belowZero" ? "#DC2626" : band === "belowMin" ? "#D97706" : "#16A34A";
}

/** A guardrail crossing rendered as an annotation row between two
    transactions. `tone` drives the rail + text colour; `label` is the
    buyer-facing call-out; `recovering` picks the trend icon. */
interface BandCrossing {
  tone: string;
  label: string;
  recovering: boolean;
}
/* Resolve the crossing (if any) when the running balance moves from `prev`
   band to `next` band. Names the guardrail just crossed — the edge of the
   band entered. Multi-band jumps report the most significant edge. */
function crossingBetween(prev: StockBand, next: StockBand): BandCrossing | null {
  if (prev === next) return null;
  if (BAND_RANK[next] > BAND_RANK[prev]) {
    const label =
      next === "belowZero"
        ? "Going below zero"
        : next === "belowMin"
          ? "Going below minimum"
          : "Going below maximum";
    return {
      tone: DROP_TONE[next as Exclude<StockBand, "healthy">],
      label,
      recovering: false,
    };
  }
  const label =
    next === "healthy"
      ? "Back above maximum"
      : next === "belowMax"
        ? "Back above minimum"
        : "Back above zero";
  return { tone: RECOVER_TONE, label, recovering: true };
}

/* ─────────────────────────── PROPS ─────────────────────────── */

export interface UnifiedTransactionStreamProps {
  demandEvents: PlannerDemandEvent[];
  incomingEvents: FutureIncomingEvent[];
  /** PO store lookup so incoming rows can resolve vendor name without
      denormalizing on the FutureIncomingEvent. */
  poByNumber: Map<string, PurchaseOrderData>;
  /** Base UoM the projection layer uses — labels every row's qty. */
  baseUom: string;
  /** When provided (and the direction filter is "All"), the table shows a
      running projected-on-hand "Balance" column — the PH-Inventory ledger
      view (point 12). Firm demand + incoming move it; reorder-point signals
      and draft SOs don't (they show "—"), so it tracks the gap-graph curve. */
  startingBalance?: number;
  /** Initial timeframe slice. Defaults to "all" (the full horizon's worth
      of rows). The Sandbox / detail modal can default this to 30 / 60 /
      90 when it makes sense. */
  defaultTimeframe?: TransactionTimeframe;
  /** Ids of predicted "what-if" rows (demand-event id for outgoing, the
      `incoming-{poNumber}-{date}-{qty}` id for incoming). Rows whose id is
      in this set render a violet PREDICTED eyebrow + wash. */
  predictedIds?: Set<string>;
  /** Host-owned simulated what-if rows (added via the SectionCard header's
      "Simulate entry" button — see SimulateEntryButton). They fold into the
      date-ordered list and the running Gap so their effect is visible, each
      with a violet SIMULATED tag + an inline remove. */
  simulatedEvents?: SimulatedTxn[];
  /** Remove handler for a simulated row's inline ×. */
  onRemoveSimulated?: (id: string) => void;

  /* ── Phase 4: Sandbox what-ifs ────────────────────────────────
     All of the props below are opt-in. When the host provides them the
     stream surfaces the matching affordances (Inject button, per-row
     action menu, phantom rows). Read-only callers (the Demand Item
     Detail modal) leave them undefined and get the clean read-only
     stream from Phase 3.

     Adjustments are keyed by `UnifiedTransaction.id` — the same id the
     stream generates internally (demand event id for outgoing rows,
     `incoming-{poNumber}-{date}-{qty}` for incoming rows). The host
     supplies a `Map` so undefined / no-adjustment is the cheap case. */

  /** Sandbox planned demand — rendered as outgoing rows with a violet
      PLANNED eyebrow. (Proposed POs are intentionally NOT routed
      through this stream; they live in the "Create POs" workspace so
      the transaction column never mixes "what's happening to my
      supply" with "what I'm planning to buy".) */
  phantomDemand?: PhantomDemandTransaction[];
  /** Per-transaction adjustment lookup. */
  adjustments?: Map<string, TransactionAdjustment>;

  /** Per-row "Cancel / exclude" action. Visible when provided. */
  onExcludeTransaction?: (txId: string) => void;
  /** Per-row "Flag as problematic" action. Visible when provided. */
  onFlagTransaction?: (txId: string) => void;
  /** Per-row "Restore" action — clears an active adjustment. Visible
      when the row already has one and the host provided this callback. */
  onRestoreTransaction?: (txId: string) => void;
  /** Per-row "Remove" action on phantom rows. */
  onRemovePhantom?: (txId: string) => void;
  /** "Inject hypothetical order" affordance. When provided, the slicer
      row shows a "+ Inject" button that opens an inline form. */
  onInjectPhantomDemand?: (data: {
    qty: number;
    requiredDate: string;
    reason?: string;
  }) => void;
  /** Day offset (0 = today) currently hovered on the gap graph, or null. Rows
      whose `daysFromToday` matches get highlighted in their event colour —
      the graph↔table cross-highlight. */
  highlightDay?: number | null;
  /** Draft POs to fold into the ledger as Draft-PO rows when the host's "Draft POs" toggle is on. */
  draftIncoming?: FutureIncomingEvent[];
  /** Optional controlled "show drafts" state (Eli 2026-07-16 — same
      toggle now drives graph + projection curve upstream). When both
      `showDrafts` and `onShowDraftsChange` are provided, the toggle
      pill defers to the parent; otherwise it falls back to internal
      state (backward-compat for standalone callers). */
  showDrafts?: boolean;
  onShowDraftsChange?: (next: boolean) => void;
  /** Table→graph hover bridge: fires the hovered row's day offset (or null) so a parent can surface the gap graph's day-card (req #6). */
  onHoverRow?: (daysFromToday: number | null) => void;
  /** Forwarded from PlannerTransactionTable — fires with the live
      pixel minimum required by the currently-visible columns so the
      workspace can shrink the tx panel when columns are hidden. */
  onTxMinWidthChange?: (minPx: number) => void;

  /** Host-owned planned vendor POs (the buyer's allocations on the gap graph /
      vendor panel). Rendered as incoming rows with a blue PLANNED badge so the
      table mirrors the gap graph's *enhanced* curve — every projected-stock
      bump has a row that explains it. */
  plannedIncoming?: PlannedIncomingTxn[];

  /** Projected ATP per day (0 = today), taken straight from the gap graph's
      enhanced curve. When provided, the "Projected stock" column reads this
      curve at each row's date instead of accumulating a separate running
      balance — so the table can never drift from the graph. Out-of-window
      days clamp to the nearest end (past → day 0, beyond horizon → last day),
      matching how `projectAtpCurve` buckets events. */
  atpByDay?: Map<number, number>;

  /** Item guardrails. When provided (with `startingBalance`), the ledger
      inserts band-crossing annotation rows wherever the running projected
      stock crosses a level — colour-trained to the gap graph (max slate · min
      amber · zero red · recovery green). */
  minLevel?: number;
  maxLevel?: number;
  /** Commit a simulated what-if (demand / supply). Routed from the shared
      PlannerAddChooser that the header "Add" and the between-row "+" both open —
      the SAME modal the gap graph uses. */
  onAddSimulated?: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;

  /* ── Graph parity: ONE add modal across both surfaces ──
     The table is a second view of the same plan, so its "Add" affordances open
     the shared PlannerAddChooser (the exact chooser the gap graph uses): plan a
     PO from a qualified vendor / show all vendors, or simulate supply / demand.
     Plotting routes through the same proposed-PO handler, so a vendor added here
     shows on the graph instantly, and vice-versa. */
  item?: PlannerItem;
  vendors?: PlannerVendor[];
  /** Full marketplace (qualified + non-qualified pool) — the chooser's "Show all vendors" path. */
  allVendors?: PlannerVendor[];
  /** Need-by day (0 = today) — drives the vendor picker's on-time / late pill. */
  deadlineDay?: number | null;
  /** Plot a qualified vendor as a planned PO at `day` (0 = today). Same handler
      the gap graph's "Add a qualified vendor" path calls. */
  onPlotVendor?: (vendorId: string, day: number, qty: number) => void;
}

/* ─────────────────────────── COMPONENT ─────────────────────────── */

export default function UnifiedTransactionStream({
  demandEvents,
  incomingEvents,
  poByNumber,
  baseUom,
  startingBalance,
  defaultTimeframe = "all",
  predictedIds,
  simulatedEvents,
  onRemoveSimulated,
  phantomDemand,
  adjustments,
  onExcludeTransaction,
  onFlagTransaction,
  onRestoreTransaction,
  onRemovePhantom,
  onInjectPhantomDemand,
  highlightDay,
  draftIncoming,
  onHoverRow,
  onTxMinWidthChange,
  plannedIncoming,
  atpByDay,
  minLevel,
  maxLevel,
  onAddSimulated,
  item,
  vendors,
  allVendors,
  deadlineDay,
  onPlotVendor,
  showDrafts: showDraftsProp,
  onShowDraftsChange,
}: UnifiedTransactionStreamProps) {
  /* Direction filter — single-select with "all" as the default.
     Previously a multi-select array where empty == show-everything;
     surfacing an explicit "All" chip makes the default state legible
     and matches how purchasing managers think about their work surface
     ("show me everything" vs "drill into one direction"). */
  const [direction, setDirection] = useState<TransactionDirection | "all">("all");
  const [timeframe, setTimeframe] = useState<TransactionTimeframe>(defaultTimeframe);
  const [injectOpen, setInjectOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /* Draft-PO visibility (req #10) — controlled when the host passes
     `showDrafts` + `onShowDraftsChange` (planner workspace does; Eli
     2026-07-16: single source-of-truth across graph + curve + table).
     Falls back to local state for standalone callers. Off by default. */
  const [showDraftsLocal, setShowDraftsLocal] = useState(false);
  const showDrafts = showDraftsProp ?? showDraftsLocal;
  const setShowDrafts = (next: boolean) => {
    if (onShowDraftsChange) onShowDraftsChange(next);
    else setShowDraftsLocal(next);
  };
  /* Fluid scale (matches the gap graph): CAPPED at 1.0 — NO up-scaling on 2K/4K
     (the buyer found scaled-up fonts too large), so it renders at base size on
     every screen ≥ 1080p. Fonts read the `--gs` CSS var (set on the root) via calc;
     column widths use gs(). Raise the upper clamp below to re-enable big-screen growth. */
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const uiScale = Math.min(1, Math.max(1, viewportW / 1920));
  const gs = (px: number) => Math.round(px * uiScale);
  /* After a simulated row is added, the id to scroll the pager to so the new
     entry is visible even when its date lands on a later page. */
  const [focusId, setFocusId] = useState<string | null>(null);
  /* Ids of simulated rows already seen — lets us spot a newly-added one (the
     list is host-owned) and jump the pager to it. */
  const seenSimIds = useRef<Set<string>>(new Set());

  const hasRowActions =
    !!onExcludeTransaction || !!onFlagTransaction || !!onRestoreTransaction || !!onRemovePhantom;
  const hasInject = !!onInjectPhantomDemand;
  /* Every "Add" affordance — the header pill and the between-row "+" — opens the
     shared PlannerAddChooser, the same modal the gap graph uses. Needs an item. */
  const canAdd =
    !!item && (!!onAddSimulated || (!!onPlotVendor && !!vendors && vendors.length > 0));

  /* Spot a freshly-added simulated row and queue a jump to its page. */
  useEffect(() => {
    const list = simulatedEvents ?? [];
    const fresh = list.find((s) => !seenSimIds.current.has(s.id));
    seenSimIds.current = new Set(list.map((s) => s.id));
    if (fresh) setFocusId(fresh.id);
  }, [simulatedEvents]);

  /* ── Merge + sort ───────────────────────────────────────────── */
  const transactions = useMemo<UnifiedTransaction[]>(() => {
    const today = todayMs();
    const txs: UnifiedTransaction[] = [];

    /* Real demand → outgoing */
    for (const ev of demandEvents) {
      /* Low-stock reorder signals aren't consuming demand and the gap graph
         filters them out of its plotted dots, so the table omits them too —
         "Low stock" is no longer a row type here, keeping both views in sync. */
      if (ev.source === "LowStock") continue;
      const shipped = ev.qtyShipped ?? 0;
      const cancelled = ev.qtyCancelled ?? 0;
      const outstanding = Math.max(0, ev.qty - shipped - cancelled);
      if (outstanding <= 0) continue;
      const ms = new Date(ev.requiredDate).getTime() - today;
      const daysFromToday = Math.round(ms / 86_400_000);
      const typeLabel =
        ev.source === "SO" ? "SO" : ev.source === "Request" ? "Purchase Request" : ev.source;
      txs.push({
        id: ev.id,
        direction: "outgoing",
        date: ev.requiredDate,
        daysFromToday,
        qty: -outstanding,
        typeLabel,
        reference: ev.sourceRef,
        /* SO → customer; Request / LowStock → requester. The reason
           (when present) renders on its own line below — see the
           `reason` field. */
        partyLabel: ev.source === "SO" ? ev.customer : ev.requester,
        reason: ev.reason,
        state: ev.state,
        priority: ev.priority,
        adjustment: adjustments?.get(ev.id),
        isPredicted: predictedIds?.has(ev.id),
      });
    }

    /* Real incoming → incoming */
    for (const ev of incomingEvents) {
      const ms = new Date(ev.expectedDate).getTime() - today;
      const daysFromToday = Math.round(ms / 86_400_000);
      const vendorName =
        ev.vendorName ?? poByNumber.get(ev.poNumber)?.vendor.name ?? "—";
      const id = `incoming-${ev.poNumber}-${ev.expectedDate}-${ev.qty}`;
      txs.push({
        id,
        direction: "incoming",
        date: ev.expectedDate,
        daysFromToday,
        qty: ev.qty,
        typeLabel: "PO",
        // Seeded POs already carry a plain "PO-NNNN" number; store-derived
        // POs use their raw poNumber. Only prefix "PO-" when the incoming
        // number doesn't already look like a PO id.
        reference: ev.poNumber.startsWith("PO-") ? ev.poNumber : `PO-${ev.poNumber}`,
        partyLabel: vendorName,
        state: ev.status,
        adjustment: adjustments?.get(id),
        isPredicted: predictedIds?.has(id),
      });
    }

    /* Phantom demand → outgoing with PHANTOM marker */
    if (phantomDemand) {
      for (const ev of phantomDemand) {
        const ms = new Date(ev.requiredDate).getTime() - today;
        const daysFromToday = Math.round(ms / 86_400_000);
        txs.push({
          id: ev.id,
          direction: "outgoing",
          date: ev.requiredDate,
          daysFromToday,
          qty: -Math.abs(ev.qty),
          typeLabel: "Planned demand",
          reference: ev.id,
          partyLabel: ev.reason,
          isPhantom: true,
        });
      }
    }

    /* Simulated what-ifs → signed by direction, tagged SIMULATED. They sit in
       the same chronological order so the running Gap reflects them just like
       a real transaction. */
    for (const s of simulatedEvents ?? []) {
      const ms = new Date(s.date).getTime() - today;
      const daysFromToday = Math.round(ms / 86_400_000);
      txs.push({
        id: s.id,
        direction: s.direction,
        date: s.date,
        daysFromToday,
        qty: s.direction === "incoming" ? Math.abs(s.qty) : -Math.abs(s.qty),
        typeLabel: s.typeLabel,
        reference: s.reference,
        isSimulated: true,
      });
    }

    /* Planned vendor POs → incoming rows tagged PLANNED. These mirror the gap
       graph's proposed-PO supply so the table tracks the enhanced curve. */
    for (const p of plannedIncoming ?? []) {
      const ms = new Date(p.expectedDate).getTime() - today;
      const daysFromToday = Math.round(ms / 86_400_000);
      txs.push({
        id: p.id,
        direction: "incoming",
        date: p.expectedDate,
        daysFromToday,
        qty: Math.abs(p.qty),
        typeLabel: "PO",
        reference: "Planned purchase order",
        partyLabel: p.vendorName,
        orderDate: p.orderDate,
        isPlanned: true,
      });
    }

    /* Draft incoming POs → incoming rows tagged "Draft" (state === "Draft" so the
       shared table maps them to a hollow Draft-PO pill). Folded in only when the
       host's "Draft POs" toggle passes them — mirrors the "Real incoming" loop
       above but marks the row as a draft. */
    if (draftIncoming && showDrafts) {
      for (const ev of draftIncoming) {
        const ms = new Date(ev.expectedDate).getTime() - today;
        const daysFromToday = Math.round(ms / 86_400_000);
        const vendorName =
          ev.vendorName ?? poByNumber.get(ev.poNumber)?.vendor.name ?? "—";
        txs.push({
          id: `draft-${ev.poNumber}-${ev.expectedDate}`,
          direction: "incoming",
          date: ev.expectedDate,
          daysFromToday,
          qty: Math.abs(ev.qty),
          typeLabel: "PO",
          // Seeded POs already carry a plain "PO-NNNN" number; store-derived
          // POs use their raw poNumber. Only prefix "PO-" when the incoming
          // number doesn't already look like a PO id.
          reference: ev.poNumber.startsWith("PO-") ? ev.poNumber : `PO-${ev.poNumber}`,
          partyLabel: vendorName,
          state: "Draft",
        });
      }
    }

    return txs.sort((a, b) => a.date.localeCompare(b.date));
  }, [demandEvents, incomingEvents, poByNumber, phantomDemand, adjustments, predictedIds, simulatedEvents, plannedIncoming, draftIncoming, showDrafts]);

  /* ── Shared-table rows ────────────────────────────────────────
     Adapt the assembled UnifiedTransaction list into the shared TxRowData shape
     the NEW PlannerTransactionTable renders. enrichTransactions ports this
     file's own band / crossing / movement / running-balance logic, so the new
     table can never drift from the stream it replaces. vendorUnitPrice seeds the
     synthesized line pricing: the primary qualified vendor's unitPrice (or the
     first vendor's), read from the item's qualifiedVendors, then the `vendors`
     prop as a fallback. */
  const txRows = useMemo(() => {
    const vendorPool = item?.qualifiedVendors ?? vendors ?? [];
    const vendorUnitPrice =
      (vendorPool.find((v) => v.primaryFlag) ?? vendorPool[0])?.unitPrice;
    /* poNumber → PO id resolver — lets the ledger's Draft-PO + PO-receipt
       rows link back to the detail page. Derived from the poByNumber map
       already passed in by the host (workspace or item-quickview). */
    const poIdByNumber = new Map<string, string>();
    for (const [num, po] of poByNumber) poIdByNumber.set(num, po.id);
    return enrichTransactions(transactions, {
      startingBalance: startingBalance ?? 0,
      minLevel,
      maxLevel,
      baseUom,
      vendorUnitPrice,
      poIdByNumber,
    });
  }, [transactions, startingBalance, minLevel, maxLevel, baseUom, item, vendors, poByNumber]);

  /* ── Slice ──────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let xs = transactions;
    if (direction !== "all") {
      xs = xs.filter((t) => t.direction === direction);
    }
    if (timeframe !== "all") {
      xs = xs.filter((t) => t.daysFromToday <= timeframe);
    }
    return xs;
  }, [transactions, direction, timeframe]);

  /* ── Running projected-on-hand balance (PH-Inventory ledger) ──
     Walks the chronological sequence from the opening on-hand so the column
     reads "on-hand now → minus as demand hits → plus as supply lands" — the
     honest per-row ledger, not the gap graph's day-0-folded ATP (which can
     read negative on the very first row). Reorder-point signals, draft SOs and
     adjusted rows don't move inventory, so they carry the balance forward
     unchanged (their QTY is a flag, not a movement). Every row records the
     balance after it, so the column is continuous. */
  const balanceById = useMemo(() => {
    const m = new Map<string, number>();
    if (startingBalance == null) return m;
    let bal = startingBalance;
    for (const t of transactions) {
      if (isMovement(t)) bal += t.qty;
      m.set(t.id, bal);
    }
    return m;
  }, [transactions, startingBalance]);
  /* The running balance is well-defined for every row regardless of filter, so
     show it whenever the host gave us an opening on-hand. */
  const showBalance = startingBalance != null;

  /* ── Band-crossing annotations ──
     Walk the same chronological balances and flag the row after which the
     running stock crosses a guardrail (down = warning, up = recovery), keyed
     by transaction id so the annotation renders right under that row. Only
     surfaced in the unfiltered "All" view, where the full story is visible. */
  const crossingById = useMemo(() => {
    const m = new Map<string, BandCrossing>();
    if (startingBalance == null || minLevel == null || maxLevel == null) return m;
    let prevBand = bandOf(startingBalance, minLevel, maxLevel);
    for (const t of transactions) {
      const bal = balanceById.get(t.id);
      if (bal == null) continue;
      const band = bandOf(bal, minLevel, maxLevel);
      const cross = crossingBetween(prevBand, band);
      if (cross) m.set(t.id, cross);
      prevBand = band;
    }
    return m;
  }, [transactions, balanceById, startingBalance, minLevel, maxLevel]);
  const showAnnotations = crossingById.size > 0 && direction === "all";
  /* The pinned "Opening on-hand" baseline node sits above the first
     transaction whenever we can anchor the ledger to a starting balance. */
  const showOpeningRow = showBalance && direction === "all";

  /* Band entering / leaving each node — colours the spine segments above and
     below the marker (the line turns amber below min, red below zero). */
  const bandInfoById = useMemo(() => {
    const m = new Map<string, { before: StockBand; after: StockBand }>();
    if (startingBalance == null || minLevel == null || maxLevel == null) return m;
    let prev = bandOf(startingBalance, minLevel, maxLevel);
    for (const t of transactions) {
      const bal = balanceById.get(t.id);
      const after = bal == null ? prev : bandOf(bal, minLevel, maxLevel);
      m.set(t.id, { before: prev, after });
      prev = after;
    }
    return m;
  }, [transactions, balanceById, startingBalance, minLevel, maxLevel]);
  const openingBand =
    startingBalance != null && minLevel != null && maxLevel != null
      ? bandOf(startingBalance, minLevel, maxLevel)
      : "healthy";

  /* ── Projected stock from the gap graph's enhanced curve ──
     When the host passes `atpByDay`, the "Projected stock" column reads that
     curve at each row's day — so the table value IS the graph value, never a
     separately-accumulated number that can drift. Out-of-window days clamp to
     the nearest end (past → day 0, beyond horizon → last day), matching how
     `projectAtpCurve` buckets events. A direction filter no longer hides the
     column (the curve value is independent of which rows are shown). Read-only
     callers that omit `atpByDay` keep the running-balance fallback above. */
  const useCurve = atpByDay != null;
  const maxCurveDay = useMemo(() => {
    if (!atpByDay || atpByDay.size === 0) return 0;
    let mx = 0;
    for (const d of atpByDay.keys()) if (d > mx) mx = d;
    return mx;
  }, [atpByDay]);
  const projectedStockAt = (day: number): number | undefined => {
    if (!atpByDay) return undefined;
    return atpByDay.get(Math.max(0, Math.min(maxCurveDay, day)));
  };

  /* ── Infinite scroll ──────────────────────────────────────────
     Render INITIAL_ROWS up front, then grow by LOAD_MORE whenever the bottom
     sentinel scrolls into the list viewport. `visibleCount` resets when the
     active slice changes. */
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setVisibleCount(INITIAL_ROWS);
  }, [direction, timeframe]);
  /* Grow when the sentinel enters the scroll viewport (rootMargin gives a head
     start so rows are ready before the user hits the very bottom). */
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(filtered.length, c + LOAD_MORE));
        }
      },
      { root, rootMargin: "160px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [filtered.length, visibleCount]);
  /* After a simulated row is added, make sure its index is within the visible
     window so the new entry is on screen even when its date sorts it deep. */
  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((t) => t.id === focusId);
    if (idx >= 0) setVisibleCount((c) => Math.max(c, idx + 1));
    setFocusId(null);
  }, [focusId, filtered]);
  const pageRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;

  /* ── Table columns ──
     Date · Type · Source · Description · QTY · On hand. Description carries the
     plain-English summary and has NO fixed width, so it absorbs the leftover
     space under table-fixed layout (the others are fixed). A narrow trailing
     actions column appears only when a row can be removed / adjusted. */
  const hasActionsCol = hasRowActions || (simulatedEvents?.length ?? 0) > 0;
  const heads: { key: string; label: string; align: "left" | "right"; width?: number }[] = [
    { key: "date", label: "Date", align: "left", width: gs(148) },
    /* Header reads "Expected delivery" (Areeb, 2026-06-24) but the column still
       carries the planned-PO ORDER date — the day it must be placed (arrival −
       lead time), the graph's hollow diamond. Only the header copy changed per
       request; the value + tooltip still reflect the order date (the actual
       arrival/receiving date is the "Date" column). Blank ("—") for every other
       row type, which has only one date. Widened for the longer label. */
    { key: "orderby", label: "Expected delivery", align: "left", width: gs(160) },
    { key: "type", label: "Type", align: "left", width: gs(176) },
    { key: "source", label: "Source", align: "left", width: gs(120) },
    { key: "description", label: "Description", align: "left" },
    { key: "qty", label: "QTY", align: "right", width: gs(88) },
    { key: "onhand", label: "On hand", align: "right", width: gs(86) },
    ...(hasActionsCol ? [{ key: "actions", label: "", align: "right" as const, width: gs(36) }] : []),
  ];
  const colCount = heads.length;
  /* Min table width so the columns never crush on a narrow/resized panel — the
     fixed widths plus a sensible floor for the flexible Description column. The
     scroll container is overflow-auto, so below this the table scrolls
     horizontally instead of cropping; above it the table fills (w-full). */
  const tableMinW = heads.reduce((sum, h) => sum + (h.width ?? gs(160)), 0);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ fontFamily: FONT, "--gs": uiScale } as React.CSSProperties}
      data-unified-transaction-stream
    >
      <PlannerTransactionTable
        rows={txRows}
        highlightDay={highlightDay}
        onHoverRow={onHoverRow}
        onMinWidthChange={onTxMinWidthChange}
        /* Row 2 (pill row): Draft POs toggle sits alongside the direction
           + sort chips so all filter/state controls live together. */
        leftSlot={
          draftIncoming && draftIncoming.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowDrafts((v) => !v)}
              title="Include draft purchase orders in the ledger"
              /* Matches the DirectionChip / SortChip compaction pattern in
                 PlannerTransactionTable so the Draft POs pill visually
                 aligns with All / Inventory creation / Consumption /
                 Newest first / Oldest first on <2xl. Font size / line
                 height moved off inline style so the responsive `2xl:`
                 variants can win. */
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors cursor-pointer shrink-0 text-[10px] font-medium leading-4"
              style={{
                fontFamily: FONT,
                ...(showDrafts
                  ? { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary))" }
                  : { backgroundColor: "transparent", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }),
              }}
              onMouseEnter={(e) => { if (!showDrafts) { e.currentTarget.style.backgroundColor = "hsl(var(--muted))"; e.currentTarget.style.color = "hsl(var(--foreground))"; } }}
              onMouseLeave={(e) => { if (!showDrafts) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; } }}
              aria-pressed={showDrafts}
            >
              {/* Icon + label matched to the graph legend chip so both
                  surfaces read as the same control. When ON: white
                  circle + 1.5px dashed green (#059669) border — the
                  same dashed-hollow marker the graph uses for a
                  Draft PO dot on the line. When OFF: neutral grey
                  fill so it reads as a disabled/toggled-off swatch. */}
              <span
                className="inline-block size-2 rounded-full"
                style={
                  showDrafts
                    ? { backgroundColor: "#FFFFFF", border: "1.5px dashed #059669" }
                    : { backgroundColor: "#CBD5E1" }
                }
              />
              Draft purchase orders
            </button>
          ) : undefined
        }
        /* Row 1 (top-right): primary Simulate entry action + optional
           "Add planned demand" affordance. Blue primary styling — this is
           the main way buyers enter a new transaction from this surface. */
        rightSlot={
          <div className="flex items-center gap-2">
            {canAdd && item && (
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Plan a purchase or simulate a what-if"
                    className="inline-flex items-center gap-1 h-7 rounded-md px-2 text-[11.5px] cursor-pointer transition-opacity shrink-0 hover:opacity-90 2xl:gap-1.5 2xl:h-9 2xl:px-3 2xl:text-[12.5px]"
                    style={{
                      fontFamily: FONT,
                      fontWeight: 600,
                      backgroundColor: "#0A77FF",
                      color: "#FFFFFF",
                      border: "1px solid #0A77FF",
                    }}
                  >
                    <Plus className="size-2.5 2xl:size-3.5" />
                    Simulate
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={4}
                  className="w-[min(320px,calc(100vw-32px))] max-h-[calc(100vh-64px)] overflow-y-auto p-0 z-[300]"
                  onInteractOutside={(e) => {
                    /* Clicking the floating date-calendar (portaled to body) must not
                       close this chooser popover. */
                    const t = e.detail.originalEvent.target as HTMLElement | null;
                    if (t?.closest("[data-planner-datecal]")) e.preventDefault();
                  }}
                >
                  <PlannerAddChooser
                    item={item}
                    vendors={vendors}
                    allVendors={allVendors}
                    anchorDate={isoToday()}
                    anchorDay={0}
                    deadlineDay={deadlineDay}
                    onSimulateAdd={onAddSimulated}
                    onPlotVendor={onPlotVendor}
                    onClose={() => setAddOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            )}
            {hasInject && (
              <Popover open={injectOpen} onOpenChange={setInjectOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Add a forecasted demand event to the planning projection"
                    className="inline-flex items-center gap-1 h-7 rounded-md px-2 text-[11.5px] cursor-pointer transition-colors shrink-0 2xl:gap-1.5 2xl:h-9 2xl:px-3 2xl:text-[12.5px]"
                    style={{
                      fontFamily: FONT,
                      fontWeight: 600,
                      backgroundColor: "transparent",
                      color: "#0A77FF",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    <Plus className="size-2.5 2xl:size-3.5" />
                    Add planned demand
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={4} className="w-[min(320px,calc(100vw-32px))] max-h-[calc(100vh-64px)] overflow-y-auto p-0 z-[300]">
                  <InjectForm
                    baseUom={baseUom}
                    onCancel={() => setInjectOpen(false)}
                    onSubmit={(data) => {
                      onInjectPhantomDemand?.(data);
                      setInjectOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        }
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** Demand-forecast form — small Popover body that lets the buyer drop a
    forecasted demand event into the planning projection. Inputs: qty
    (positive integer) + need-by date (default tomorrow, with quick
    presets) + optional reason (with quick-pick presets matching common
    purchasing-manager scenarios). Submit fires the host callback; the
    stream itself stays state-free for the phantom data (the Sandbox
    owns it).

    Copy is ERP-aligned — purchasing managers think in terms of
    "planned demand", "need-by date", "MRP" and recognised reason
    categories (rush order, customer commit, seasonal uplift, etc.). */

/** Common purchasing-manager scenarios that justify adding a planned
    demand line during MRP. Each chip pre-fills the reason field; the
    buyer can still type a custom reason. */
const PLANNED_DEMAND_REASONS: ReadonlyArray<string> = [
  "Rush customer order",
  "Customer commit",
  "Seasonal uplift",
  "MRP override",
  "Safety stock build",
];

function InjectForm({
  baseUom,
  onCancel,
  onSubmit,
}: {
  baseUom: string;
  onCancel: () => void;
  onSubmit: (data: { qty: number; requiredDate: string; reason?: string }) => void;
}) {
  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Local Y/M/D (toISOString would shift a day early in TZs ahead of UTC).
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const dateOffsetIso = (days: number): string => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    // Local Y/M/D (toISOString would shift a day early in TZs ahead of UTC).
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const tomorrowIso = useMemo(() => dateOffsetIso(1), []);
  const nextWeekIso = useMemo(() => dateOffsetIso(7), []);
  const nextMonthIso = useMemo(() => dateOffsetIso(30), []);

  const [qty, setQty] = useState<string>("");
  const [requiredDate, setRequiredDate] = useState<string>(tomorrowIso);
  const [reason, setReason] = useState<string>("");
  const qtyNum = Number(qty);
  const canSubmit = Number.isFinite(qtyNum) && qtyNum > 0 && !!requiredDate;

  /* Date quick-picks: matches the way planners talk about lead time
     ("next week", "in a month") rather than forcing them into the
     native date picker for every common case. The picker is still
     there for arbitrary dates. */
  const datePresets: Array<{ label: string; iso: string }> = [
    { label: "Tomorrow", iso: tomorrowIso },
    { label: "+1 week", iso: nextWeekIso },
    { label: "+30 days", iso: nextMonthIso },
  ];

  return (
    <div className="p-3" style={{ fontFamily: FONT }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="size-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#EFF6FF" }}
        >
          <FlaskConical className="size-3.5" style={{ color: "#0A77FF" }} />
        </div>
        <div>
          <p className="text-[12.5px]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
            Add planned demand
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            Forecast a demand line — affects the planning projection only.
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] block mb-1" style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>
            Quantity ({baseUom})
          </label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="e.g. 100"
            className="h-8 text-[12px]"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>
            Need-by date
          </label>
          <SystemDatePicker
            value={requiredDate}
            onChange={setRequiredDate}
            min={new Date(todayIso + "T00:00:00")}
            placeholder="Pick a need-by date"
            className="w-full"
          />
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {datePresets.map((p) => {
              const active = requiredDate === p.iso;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setRequiredDate(p.iso)}
                  className="px-2 py-0.5 rounded-full border text-[10.5px] cursor-pointer transition-colors"
                  style={{
                    fontWeight: 500,
                    backgroundColor: active ? "#EFF6FF" : "transparent",
                    color: active ? "#0A77FF" : "hsl(var(--muted-foreground))",
                    borderColor: active ? "#BFDBFE" : "hsl(var(--border))",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>
            Reason <span className="text-slate-400">· optional</span>
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. anticipated rush order, customer commit"
            className="h-8 text-[12px]"
          />
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {PLANNED_DEMAND_REASONS.map((preset) => {
              const active = reason === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(active ? "" : preset)}
                  className="px-2 py-0.5 rounded-full border text-[10.5px] cursor-pointer transition-colors"
                  style={{
                    fontWeight: 500,
                    backgroundColor: active ? "#EFF6FF" : "transparent",
                    color: active ? "#0A77FF" : "hsl(var(--muted-foreground))",
                    borderColor: active ? "#BFDBFE" : "hsl(var(--border))",
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2.5 rounded-md text-[11px] cursor-pointer hover:bg-accent transition-colors"
          style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              qty: qtyNum,
              requiredDate,
              reason: reason.trim() || undefined,
            })
          }
          className="h-7 px-2.5 rounded-md text-[11px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            fontWeight: 600,
            backgroundColor: "#0A77FF",
            color: "#FFFFFF",
          }}
        >
          Add to plan
        </button>
      </div>
    </div>
  );
}

/** "Simulate entry" trigger + popover — the button a section header mounts
    (the planner's Transaction Table). Owns only the popover open state; the
    simulated rows themselves are host-owned (the workspace), so the button
    can live in the header, outside the table body. */
export function SimulateEntryButton({
  baseUom,
  onAdd,
}: {
  baseUom: string;
  onAdd: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add a simulated demand or supply line to see its effect on the projected gap"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] cursor-pointer transition-colors shrink-0"
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            backgroundColor: "#EFF6FF",
            color: "#0A77FF",
            borderColor: "#BFDBFE",
          }}
        >
          <FlaskConical className="size-3" />
          Simulate
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-80 p-0 z-[300]">
        <SimulateForm
          baseUom={baseUom}
          onCancel={() => setOpen(false)}
          onSubmit={(d) => {
            onAdd(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Simulate-entry form — lets the buyer drop an ad-hoc what-if transaction
    (demand or supply, positive or negative) straight into the stream. Inputs
    mirror the table's own columns: Flow (sign) + Type + Quantity + Date, with
    an optional Reference (auto-filled when blank). The Gap recomputes from the
    new row's chronological position — no projection wiring required. */
export function SimulateForm({
  baseUom,
  onCancel,
  onSubmit,
  initialDate,
  initialFlow,
  lockFlow,
}: {
  baseUom: string;
  onCancel: () => void;
  onSubmit: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
  /** Seed the date (ISO) — e.g. the day clicked on the gap graph. */
  initialDate?: string;
  /** Seed the flow — defaults to demand (outgoing). */
  initialFlow?: TransactionDirection;
  /** Hide the Flow (demand/supply) toggle and keep the flow fixed to
      `initialFlow`. Used when the caller has already chosen the direction —
      e.g. the gap graph's "Add demand" / "Add supply" entry points. */
  lockFlow?: boolean;
}) {
  const dateOffsetIso = (days: number): string => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    // Local Y/M/D (toISOString would shift a day early in TZs ahead of UTC).
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const todayIso = useMemo(() => dateOffsetIso(0), []);
  /* ISO ⇄ Date helpers for the inline month Calendar — built from local Y/M/D
     so the round-trip never shifts a day (toISOString() would convert to UTC). */
  const isoToDate = (iso: string): Date => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };
  const dateToIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* Type options per flow. Internal labels map via TYPE_DISPLAY so the
     simulated row reads with the same vocabulary as real rows.
     Purchase request is parked from procurement (2026-07-20 flag) —
     the option is dropped from the picker when the flag is off. */
  const DEMAND_TYPES: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Sales order", value: "SO" },
    ...(SHOW_PURCHASE_REQUESTS_IN_PLANNER
      ? [{ label: "Purchase request", value: "Purchase Request" }]
      : []),
  ];
  const SUPPLY_TYPES: ReadonlyArray<{ label: string; value: string }> = [
    { label: "PO", value: "PO" },
  ];

  const [flow, setFlow] = useState<TransactionDirection>(initialFlow ?? "outgoing");
  const [typeLabel, setTypeLabel] = useState<string>(
    (initialFlow ?? "outgoing") === "incoming" ? "PO" : "SO",
  );
  const [qty, setQty] = useState<string>("");
  const [date, setDate] = useState<string>(initialDate ?? todayIso);
  /* Unit of measure — Areeb feedback: sim entries need a UoM input, not just
     a label. Defaults to the item's base UoM; the buyer can pick any
     compatible unit (same dimension). qty is converted back to `baseUom`
     before commit, so the projection curve + stored txn always speak the
     canonical unit. */
  const [uom, setUom] = useState<string>(baseUom);
  const compatibleUoms = useMemo(() => getCompatibleUOMs(baseUom), [baseUom]);

  const typeOptions = flow === "incoming" ? SUPPLY_TYPES : DEMAND_TYPES;
  const qtyNum = Number(qty);
  /* Convert the picked UoM's qty to baseUom for storage. Falls back to the
     raw qty when the conversion is unavailable (uom absent from registry). */
  const qtyInBaseUom = useMemo(() => {
    const converted = convertQty(uom, baseUom, qtyNum);
    return converted ?? qtyNum;
  }, [uom, baseUom, qtyNum]);
  const canSubmit = Number.isFinite(qtyNum) && qtyNum > 0 && !!date;

  /* Description noun matches the flow: when the caller locked the direction
     (the graph's Add demand / Add supply entry points) it reads the specific
     word — "supply" for incoming, "demand" for outgoing — instead of the generic
     "demand or supply", which only applies when the flow toggle is available. */
  const simNoun = lockFlow
    ? flow === "incoming"
      ? "supply"
      : "demand"
    : "demand or supply";

  /* The gap graph passes the clicked day as `initialDate`. While the field still
     holds that seeded value, surface a hint so the date reads as "carried from
     the day you selected", not as a blank field the buyer has to fill in. */
  const seededFromGraph = !!initialDate && date === initialDate;
  const relativeDay = (() => {
    const ms = Date.parse(`${date}T00:00:00`) - Date.parse(`${todayIso}T00:00:00`);
    const days = Math.round(ms / 86400000);
    if (!Number.isFinite(days)) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days > 0) return `in ${days} days`;
    return `${-days} day${days === -1 ? "" : "s"} ago`;
  })();

  /* Date field — a compact input that opens the month calendar as a FLOATING
     overlay (portaled to body), instead of an always-on inline block. So it no
     longer eats vertical space, and it floats above the host chooser popover.
     Outside-click closes it; the host popover is kept open via its own
     `onInteractOutside` guard keyed on `[data-planner-datecal]`. */
  const [calOpen, setCalOpen] = useState(false);
  const [calAnchor, setCalAnchor] = useState<{ left: number; top: number } | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);
  const calPopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (calPopRef.current?.contains(t)) return;
      if (dateBtnRef.current?.contains(t)) return;
      setCalOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [calOpen]);
  const fmtInputDate = (iso: string): string =>
    isoToDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  /* Switching flow resets the type to that flow's default kind. */
  const setFlowAndType = (next: TransactionDirection) => {
    setFlow(next);
    setTypeLabel(next === "incoming" ? "PO" : "SO");
  };

  const flowOptions = [
    {
      dir: "outgoing" as const,
      label: "Demand (−)",
      Icon: ArrowDown,
      bg: "var(--status-cancelled-bg)",
      fg: "var(--status-cancelled-text)",
    },
    {
      dir: "incoming" as const,
      label: "Supply (+)",
      Icon: ArrowUp,
      bg: "var(--status-received-bg)",
      fg: "var(--status-received-text)",
    },
  ];

  return (
    <div className="p-3" style={{ fontFamily: FONT }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="size-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#EFF6FF" }}
        >
          <FlaskConical className="size-3.5" style={{ color: "#0A77FF" }} />
        </div>
        <div>
          <p className="text-[12.5px]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
            {lockFlow
              ? flow === "outgoing"
                ? "Simulate demand"
                : "Simulate supply"
              : "Simulate transaction"}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            {lockFlow
              ? flow === "outgoing"
                ? "Plot how a new order changes projected stock."
                : "Add incoming stock, real or hypothetical, to the timeline."
              : `Drop in a hypothetical ${simNoun} to preview the impact on the graph.`}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {/* Flow — demand (out / −) vs supply (in / +). Hidden when the caller
            locked the direction (e.g. the graph's Add demand / Add supply). */}
        {!lockFlow && (
        <div>
          <label
            className="text-[11px] block mb-1"
            style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
          >
            Flow
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {flowOptions.map(({ dir, label, Icon, bg, fg }) => {
              const active = flow === dir;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setFlowAndType(dir)}
                  className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md border text-[12px] cursor-pointer transition-colors"
                  style={{
                    fontWeight: 600,
                    backgroundColor: active ? bg : "transparent",
                    color: active ? fg : "hsl(var(--muted-foreground))",
                    borderColor: active ? fg : "hsl(var(--border))",
                  }}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Type row retired 2026-07-14: the sales-order / purchase-
            request distinction wasn't earning the vertical real
            estate on this card. The default type still ships with
            the commit (PO for incoming, SO for outgoing) via the
            initial `typeLabel` state; buyers who need a different
            type can pick it after the fact from the transaction
            ledger. */}

        {/* Quantity + UoM — the qty is entered in the buyer's chosen unit
            (any compatible UoM), then converted back to the item's base UoM
            on commit so the projection curve + stored txn always speak the
            canonical unit. A "= N BaseUom" preview appears when the picked
            unit differs from the base. */}
        <div>
          <label
            className="text-[11px] block mb-1"
            style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
          >
            How much?
          </label>
          <div className="flex items-stretch gap-1.5">
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-8 flex-1 text-[12px]"
              autoFocus
            />
            {compatibleUoms.length > 1 ? (
              /* shadcn Select — matches the Simulate supply wizard's UOM
                 picker (buyer 2026-07-21: "use same component in demand
                 as well"). Scrollable list, capped at ~5 rows so a
                 12-item UOM catalogue doesn't overflow the viewport. */
              <Select value={uom} onValueChange={setUom}>
                <SelectTrigger className="h-8 w-[110px] text-[12px]">
                  <SelectValue placeholder={uom || baseUom}>
                    {uom || baseUom}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto z-[70]">
                  {compatibleUoms.map((u) => (
                    <SelectItem key={u.name} value={u.name} className="text-[12px]">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span
                className="inline-flex h-8 items-center rounded-md border border-input bg-slate-50/60 px-2 text-[12px]"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
              >
                {baseUom}
              </span>
            )}
          </div>
          {uom !== baseUom && qtyNum > 0 && Number.isFinite(qtyInBaseUom) && (
            <p className="mt-1 text-[10.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              = {qtyInBaseUom.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseUom}
            </p>
          )}
        </div>

        {/* Date — "When?" reads more naturally next to "How much?" above. */}
        <div>
          <label
            className="text-[11px] block mb-1"
            style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
          >
            When?
          </label>
          {/* A date INPUT that opens the month calendar as a floating overlay on
             click (portaled to body, so the host chooser popover's overflow can't
             clip it and it floats over the modal rather than sitting as a section).
             `data-planner-datecal` lets the host popover keep itself open when the
             calendar is clicked (see its onInteractOutside guard). */}
          <button
            ref={dateBtnRef}
            type="button"
            onClick={() => {
              const r = dateBtnRef.current?.getBoundingClientRect();
              if (r) {
                /* Collision-aware placement — mirrors the Supply flow's
                   Popover behaviour (Radix auto-flips when the trigger sits
                   near the viewport edge). This manual portal doesn't
                   inherit that logic, so we compute it here: if there
                   isn't ~340px of room below the button, flip the popover
                   ABOVE it. Buyer feedback: the Simulate demand calendar
                   was clipped by the modal footer when the date row sat
                   near the bottom. */
                const CAL_H = 340;
                const GAP = 4;
                const spaceBelow = window.innerHeight - r.bottom;
                const flipAbove = spaceBelow < CAL_H + GAP && r.top > CAL_H + GAP;
                setCalAnchor({
                  left: r.left,
                  top: flipAbove ? r.top - CAL_H - GAP : r.bottom + GAP,
                });
              }
              setCalOpen((o) => !o);
            }}
            aria-haspopup="dialog"
            aria-expanded={calOpen}
            className="h-8 w-full inline-flex items-center justify-between rounded-md border border-input bg-transparent px-3 text-[12px] cursor-pointer transition-colors hover:bg-accent/40"
            style={{ color: "hsl(var(--foreground))" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {fmtInputDate(date)}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {calOpen &&
            calAnchor &&
            createPortal(
              <div
                ref={calPopRef}
                data-planner-datecal=""
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed z-[401] rounded-md border border-input bg-popover shadow-xl"
                style={{
                  left: Math.max(8, Math.min(calAnchor.left, window.innerWidth - 268)),
                  /* Clamp the top so the calendar never draws under the
                     viewport floor even if the button flip check missed a
                     resize edge case. 8px cushion, 340px assumed height. */
                  top: Math.max(8, Math.min(calAnchor.top, window.innerHeight - 340)),
                }}
              >
                <Calendar
                  mode="single"
                  selected={isoToDate(date)}
                  onSelect={(d) => {
                    if (!d) return;
                    setDate(dateToIso(d));
                    setCalOpen(false);
                  }}
                  defaultMonth={isoToDate(date)}
                  numberOfMonths={1}
                  disabled={[{ before: isoToDate(todayIso) }, { after: isoToDate(dateOffsetIso(365)) }]}
                  className="p-2"
                />
              </div>,
              document.body,
            )}
          {seededFromGraph && (
            <p
              className="mt-1 text-[10.5px] leading-snug"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              The day picked on the graph{relativeDay ? `, ${relativeDay}` : ""}. Change it for a different date.
            </p>
          )}
        </div>

      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 px-2.5 rounded-md text-[11px] cursor-pointer hover:bg-accent transition-colors"
          style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              direction: flow,
              typeLabel,
              qty: qtyInBaseUom,
              date,
            })
          }
          className="h-7 px-2.5 rounded-md text-[11px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontWeight: 600, backgroundColor: "#0A77FF", color: "#FFFFFF" }}
        >
          Add simulation
        </button>
      </div>
    </div>
  );
}

/* ─── Transaction row — one line in the ledger table ───
   Date · Type · Source · QTY · running On-hand, sharing the header's grid
   template so the columns line up. The On-hand value is colour-trained to the
   gap graph's guardrail bands (green at/above min, amber below min, red below
   zero), so the row itself signals the stock state — the matching "Going
   below ..." call-out renders as a CrossingAnnotation line directly beneath. */
function TxRow({
  t,
  balance,
  moving,
  bandInfo,
  highlightDay,
  baseUom,
  hasActionsCol,
  onRemoveSimulated,
  hasRowActions,
  onExcludeTransaction,
  onFlagTransaction,
  onRestoreTransaction,
  onRemovePhantom,
}: {
  t: UnifiedTransaction;
  balance: number | undefined;
  moving: boolean;
  bandInfo?: { before: StockBand; after: StockBand };
  highlightDay?: number | null;
  baseUom: string;
  hasActionsCol: boolean;
  onRemoveSimulated?: (id: string) => void;
  hasRowActions: boolean;
  onExcludeTransaction?: (id: string) => void;
  onFlagTransaction?: (id: string) => void;
  onRestoreTransaction?: (id: string) => void;
  onRemovePhantom?: (id: string) => void;
}) {
  const inc = t.qty > 0;
  const isAdjusted = !!t.adjustment;
  const muted = isAdjusted || !moving;
  const description = describeTransaction(t);
  const isHovered = highlightDay != null && t.daysFromToday === highlightDay;
  const evColor = eventColorFor(t.typeLabel, t.direction);
  const adjTone = t.adjustment ? ADJUSTMENT_TONE[t.adjustment] : null;
  const badgeBg = muted
    ? "#F1F5F9"
    : inc
      ? "var(--status-received-bg)"
      : "var(--status-cancelled-bg)";
  const arrowFg = muted
    ? "#94A3B8"
    : inc
      ? "var(--status-received-text)"
      : "var(--status-cancelled-text)";
  /* On-hand colour: grey for non-movement rows, otherwise the band tone (green
     / amber / red) so the running number carries the stock state. */
  const balColor =
    balance == null
      ? "#CBD5E1"
      : muted
        ? "#94A3B8"
        : bandInfo
          ? lineTone(bandInfo.after)
          : balance < 0
            ? "#B91C1C"
            : "#334155";
  /* A planned PO no longer carries a separate "PLANNED PO" overlay badge — its
     blue "Planned PO" type pill (graphDotFor → proposed) already marks it, the
     same way the gap graph distinguishes a planned PO by colour alone. The
     overlay is reserved for what-if states the type pill can't express
     (simulated / predicted / forecasted phantom demand). */
  const whatIf = t.isSimulated
    ? { label: "SIMULATED", Icon: FlaskConical, bg: "#EFF6FF", fg: "#0A77FF", bd: "#BFDBFE" }
    : t.isPredicted
      ? { label: "PREDICTED", Icon: Sparkles, bg: "#EFF6FF", fg: "#0A77FF", bd: "#BFDBFE" }
      : t.isPhantom
        ? { label: "PLANNED", Icon: Sparkles, bg: "#EFF6FF", fg: "#0A77FF", bd: "#BFDBFE" }
        : null;
  const WhatIfIcon = whatIf?.Icon;
  /* Only the graph↔table hover cross-highlight tints a row now. The persistent
     blue wash on planned/simulated/predicted rows was dropped — their badges
     (PLANNED PO / SIMULATED / …) already mark them, so the wash just added
     clutter on top of the band-coloured On-hand numbers. */
  const rowBg = isHovered ? `${evColor}14` : undefined;
  const mono = "ui-monospace, SFMono-Regular, monospace";
  /* Leading type "avatar" (Slack-inspired) — a colour-coded flow marker that
     leads each row: supply ↑ (green) / demand ↓ (red), or the what-if icon
     (planned / simulated / predicted) in blue. The at-a-glance "what is this",
     so direction is read before any text. */
  const AvatarIcon = whatIf?.Icon ?? (inc ? ArrowUp : ArrowDown);
  const avBg = whatIf ? whatIf.bg : badgeBg;
  const avFg = whatIf ? whatIf.fg : arrowFg;
  return (
    <TableRow
      className="group/txrow"
      style={{
        backgroundColor: rowBg,
        boxShadow: isHovered ? `inset 3px 0 0 0 ${evColor}` : undefined,
      }}
    >
      {/* Date — led by the colour-coded type avatar; shows the adjustment pill
         (excluded / flagged) in place of the date when the row is adjusted. */}
      <TableCell className="py-1.5" style={{ ...CELL_PAD_STYLE, fontSize: "calc(11.5px * var(--gs, 1))", color: "#475569" }}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center justify-center rounded-full shrink-0"
            style={{ width: "calc(22px * var(--gs, 1))", height: "calc(22px * var(--gs, 1))", backgroundColor: avBg }}
            aria-hidden="true"
          >
            <AvatarIcon className="size-3" style={{ color: avFg }} />
          </span>
          <span className="truncate">
            {adjTone ? (
              <span
                className="inline-flex items-center rounded-full px-1.5"
                style={{ fontSize: "calc(9.5px * var(--gs, 1))", backgroundColor: adjTone.bg, color: adjTone.fg, border: `1px solid ${adjTone.bd}` }}
              >
                {adjTone.label}
              </span>
            ) : (
              fmtDate(t.date)
            )}
          </span>
        </span>
      </TableCell>
      {/* Order by — for a planned PO, the day the order must be PLACED (arrival −
         lead time): the gap graph's hollow diamond. Every other row has a single
         date, so this reads "—". */}
      <TableCell className="py-1.5 truncate" style={{ ...CELL_PAD_STYLE, opacity: isAdjusted ? 0.6 : 1 }}>
        {t.orderDate ? (
          <span
            className="tabular-nums"
            title={`Order date ${fmtDate(t.orderDate)} → expected delivery ${fmtDate(t.date)}`}
            style={{ fontSize: "calc(11.5px * var(--gs, 1))", color: "#64748B" }}
          >
            {fmtDate(t.orderDate)}
          </span>
        ) : (
          <span style={{ fontSize: "calc(11.5px * var(--gs, 1))", color: "#CBD5E1" }}>—</span>
        )}
      </TableCell>
      {/* Type — what-if badge + the kind of transaction. Wider column + a
         flex-wrap fallback so the two chips never crop: they stay on one line
         when there's room and wrap to a second line only in very narrow/condensed
         layouts (no overflow-hidden clipping). */}
      <TableCell className="py-1.5" style={{ ...CELL_PAD_STYLE, opacity: isAdjusted ? 0.6 : 1 }}>
        <span className="flex flex-wrap items-center gap-1 min-w-0">
          {whatIf && WhatIfIcon && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 shrink-0"
              style={{
                fontSize: "calc(8.5px * var(--gs, 1))",
                fontWeight: 700,
                letterSpacing: "0.04em",
                backgroundColor: whatIf.bg,
                color: whatIf.fg,
                border: `1px solid ${whatIf.bd}`,
              }}
            >
              <WhatIfIcon className="size-2.5" />
              {whatIf.label}
            </span>
          )}
          {(() => {
            /* Type pill — identical to the gap graph's colour-key chip: same
               fill, same label, same dot treatment (proposed = ringed, draft =
               hollow dashed, else solid), slate text on a tint of the fill. So a
               pill reads the same on the graph and in the table. */
            const dot = graphDotFor(t);
            const tone = dot
              ? GRAPH_DOT[dot]
              : { fill: "#64748B", label: TYPE_DISPLAY[t.typeLabel] ?? t.typeLabel };
            const dotStyle: React.CSSProperties =
              dot === "proposed"
                ? { backgroundColor: tone.fill, boxShadow: `0 0 0 1.5px #FFFFFF, 0 0 0 3px ${tone.fill}` }
                : dot === "draft"
                  ? { backgroundColor: "#FFFFFF", border: `1.5px dashed ${tone.fill}` }
                  : { backgroundColor: tone.fill };
            return (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 shrink-0"
                style={{
                  fontSize: "calc(10.5px * var(--gs, 1))",
                  fontWeight: 500,
                  backgroundColor: `${tone.fill}14`,
                  color: "#334155",
                  border: `1px solid ${tone.fill}55`,
                }}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={dotStyle} aria-hidden="true" />
                {tone.label}
              </span>
            );
          })()}
        </span>
      </TableCell>
      {/* Source — the document reference as plain monospace text, matching the
         Partners table's code-cell style (mono · slate-800 · weight 500, no
         chip). The counterparty now lives in the Description column. */}
      <TableCell className="py-1.5 truncate" style={{ ...CELL_PAD_STYLE, opacity: isAdjusted ? 0.6 : 1 }}>
        {(() => {
          /* SO / Purchase-Request references link to their source document in
             a NEW TAB (↗), matching the Demands listing sources cell. Other
             types (Receiving / Planned / Simulated / phantom) stay plain text. */
          const docHref =
            t.typeLabel === "SO"
              ? sourceDocHref("SO", t.reference)
              : t.typeLabel === "Purchase Request"
                ? sourceDocHref("Request", t.reference)
                : null;
          /* Base type styling WITHOUT an inline color — color is set via class
             so `hover:text-primary` can win (inline styles beat hover classes). */
          const refStyle = {
            fontFamily: mono,
            fontSize: "calc(11px * var(--gs, 1))",
            fontWeight: 500,
            textDecoration: t.adjustment === "excluded" ? "line-through" : undefined,
          } as const;
          return docHref ? (
            <a
              href={docHref}
              target="_blank"
              rel="noopener noreferrer"
              title={t.reference}
              className="inline-flex max-w-full items-center gap-1 text-slate-800 transition-colors hover:text-primary hover:underline"
              style={refStyle}
            >
              <span className="truncate">{t.reference}</span>
              <ExternalLink className="size-3 shrink-0 opacity-60" />
            </a>
          ) : (
            <span title={t.reference} style={{ ...refStyle, color: "#1E293B" }}>
              {t.reference}
            </span>
          );
        })()}
      </TableCell>
      {/* Description — plain-English summary (type + counterparty + any reason);
         truncates with the full text on hover. */}
      <TableCell className="py-1.5 truncate" style={{ ...CELL_PAD_STYLE, opacity: isAdjusted ? 0.6 : 1 }}>
        <span
          title={description}
          style={{
            fontSize: "calc(11.5px * var(--gs, 1))",
            color: "#475569",
            textDecoration: t.adjustment === "excluded" ? "line-through" : undefined,
          }}
        >
          {description}
        </span>
      </TableCell>
      {/* QTY — signed magnitude. Direction is carried by the leading avatar +
         the sign, so the redundant arrow chip was dropped for a cleaner column. */}
      <TableCell className="py-1.5 text-right" style={{ ...CELL_PAD_STYLE, opacity: isAdjusted ? 0.6 : 1 }}>
        <span className="tabular-nums" style={{ fontSize: "calc(12.5px * var(--gs, 1))", fontWeight: 600, color: muted ? "#94A3B8" : "#1E293B" }}>
          {inc ? "+" : "−"}
          {Math.abs(t.qty).toLocaleString()}
        </span>
      </TableCell>
      {/* On hand — running projected stock, band-coloured. */}
      <TableCell
        className="py-1.5 text-right tabular-nums"
        style={{ ...CELL_PAD_STYLE, fontSize: "calc(12.5px * var(--gs, 1))", fontWeight: 600, color: balColor }}
      >
        {balance == null ? "—" : fmtStock(balance)}
      </TableCell>
      {/* Row actions — remove (simulated) or the adjust menu, revealed on hover. */}
      {hasActionsCol && (
        <TableCell className="px-1 text-right">
          {t.isSimulated && onRemoveSimulated ? (
            <button
              type="button"
              onClick={() => onRemoveSimulated(t.id)}
              title="Remove simulated entry"
              aria-label="Remove simulated entry"
              className="opacity-0 group-hover/txrow:opacity-100 inline-flex size-5 items-center justify-center rounded transition-colors hover:bg-accent"
              style={{ color: "#94A3B8" }}
            >
              <XIcon className="size-3" />
            </button>
          ) : hasRowActions ? (
            <RowActionMenu
              transaction={t}
              onExclude={onExcludeTransaction}
              onFlag={onFlagTransaction}
              onRestore={onRestoreTransaction}
              onRemovePhantom={onRemovePhantom}
            />
          ) : null}
        </TableCell>
      )}
    </TableRow>
  );
}

/* ─── Crossing annotation — the guardrail milestone for the row above it.
   Reads "Going below minimum / zero" (or the recovery), colour-trained to the
   gap graph's threshold breaches. Slack-"NEW"-divider-inspired: the tone-coded
   label chip is followed by a divider line carrying the same tone across the
   row, so each crossing reads as a clear milestone in the flow. NOTE: this is
   ONE line per real crossing (a milestone marker) — NOT the per-row hairlines
   removed earlier; re-added 2026-06-17 at the user's explicit request. */
function CrossingAnnotation({ cross }: { cross: BandCrossing }) {
  const Icon = cross.recovering ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: CELL_PX, paddingRight: CELL_PX }}>
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 shrink-0"
        style={{ fontSize: "calc(9.5px * var(--gs, 1))", fontWeight: 600, backgroundColor: `${cross.tone}1A`, color: cross.tone }}
      >
        <Icon className="size-2.5" />
        {cross.label}
      </span>
      <span className="flex-1 rounded-full" style={{ height: 1, backgroundColor: `${cross.tone}59` }} />
    </div>
  );
}

/** Insert affordance between two ledger rows — a connecting line spanning the
    gap with a "+" anchored to it on the left, so the insertion point is
    visually obvious. The rule is quiet at rest and lights up blue on hover;
    clicking the "+" opens the SAME Simulate form the gap graph and the header
    use, seeded with the neighbouring row's date, so a what-if drops in right
    where it belongs in the timeline. */
function InsertLine({
  item,
  vendors,
  allVendors,
  deadlineDay,
  onSimulateAdd,
  onPlotVendor,
  date,
}: {
  item: PlannerItem;
  vendors?: PlannerVendor[];
  allVendors?: PlannerVendor[];
  deadlineDay?: number | null;
  onSimulateAdd?: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
  onPlotVendor?: (vendorId: string, day: number, qty: number) => void;
  date?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group/insert relative" style={{ height: 10 }}>
      {/* Connecting line — hidden at rest to keep the table clean; fades in
         (blue) only when the row-gap is hovered or the add form is open, so the
         insertion point shows exactly when you reach for it. */}
      <div
        className={
          "absolute transition-opacity group-hover/insert:opacity-100 " +
          (open ? "opacity-100" : "opacity-0")
        }
        style={{
          left: 12,
          right: 12,
          top: "50%",
          height: 0,
          transform: "translateY(-50%)",
          borderTop: `2px solid ${open ? "#3B82F6" : "#60A5FA"}`,
        }}
      />
      {/* "+" sitting on the line — the Add action, connected to the rule. */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Add a transaction here"
            aria-label="Add a transaction here"
            className={
              "absolute z-[1] inline-flex size-[18px] items-center justify-center rounded-full border bg-white shadow-sm transition-all hover:border-[#3B82F6] hover:text-[#2563EB] hover:opacity-100 focus-visible:opacity-100 group-hover/insert:opacity-100 " +
              (open ? "opacity-100 text-[#2563EB]" : "opacity-0 text-slate-400")
            }
            style={{
              left: 4,
              top: "50%",
              transform: "translateY(-50%)",
              borderColor: open ? "#3B82F6" : "#CBD5E1",
            }}
          >
            <Plus className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[min(320px,calc(100vw-32px))] max-h-[calc(100vh-64px)] overflow-y-auto p-0 z-[300]"
          onInteractOutside={(e) => {
            /* Keep the chooser open when the floating date-calendar is clicked. */
            const t = e.detail.originalEvent.target as HTMLElement | null;
            if (t?.closest("[data-planner-datecal]")) e.preventDefault();
          }}
        >
          <PlannerAddChooser
            item={item}
            vendors={vendors}
            allVendors={allVendors}
            anchorDate={date}
            anchorDay={dayFromIso(date)}
            deadlineDay={deadlineDay}
            onSimulateAdd={onSimulateAdd}
            onPlotVendor={onPlotVendor}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Per-row action menu — opens a small Popover with Cancel / Flag /
    Restore / Remove. Which actions appear depends on row type
    (phantom vs real) and current adjustment state. */
function RowActionMenu({
  transaction,
  onExclude,
  onFlag,
  onRestore,
  onRemovePhantom,
}: {
  transaction: UnifiedTransaction;
  onExclude?: (id: string) => void;
  onFlag?: (id: string) => void;
  onRestore?: (id: string) => void;
  onRemovePhantom?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isPhantom = transaction.isPhantom;
  const hasAdjustment = !!transaction.adjustment;

  // Phantom rows only support "Remove".
  const canRemovePhantom = isPhantom && !!onRemovePhantom;
  const canExclude = !isPhantom && !!onExclude && transaction.adjustment !== "excluded";
  const canFlag = !isPhantom && !!onFlag && transaction.adjustment !== "flagged";
  const canRestore = !isPhantom && !!onRestore && hasAdjustment;

  if (!canRemovePhantom && !canExclude && !canFlag && !canRestore) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-md hover:bg-accent cursor-pointer transition-colors"
          aria-label="Row actions"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="p-1 w-44 z-[300]"
      >
        <div className="flex flex-col" style={{ fontFamily: FONT }}>
          {canExclude && (
            <ActionItem
              icon={Ban}
              label="Exclude from plan"
              hint="Drop from planning projection"
              onClick={() => {
                onExclude?.(transaction.id);
                setOpen(false);
              }}
            />
          )}
          {canFlag && (
            <ActionItem
              icon={TriangleAlert}
              label="Flag as at-risk"
              hint="Treat as unreliable"
              tone="warn"
              onClick={() => {
                onFlag?.(transaction.id);
                setOpen(false);
              }}
            />
          )}
          {canRestore && (
            <ActionItem
              icon={RotateCcw}
              label="Restore"
              hint="Clear adjustment"
              onClick={() => {
                onRestore?.(transaction.id);
                setOpen(false);
              }}
            />
          )}
          {canRemovePhantom && (
            <ActionItem
              icon={XIcon}
              label="Remove planned line"
              hint="Delete this planned demand"
              tone="danger"
              onClick={() => {
                onRemovePhantom?.(transaction.id);
                setOpen(false);
              }}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActionItem({
  icon: Icon,
  label,
  hint,
  tone = "default",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  tone?: "default" | "warn" | "danger";
  onClick: () => void;
}) {
  const color =
    tone === "warn"
      ? "#C2410C"
      : tone === "danger"
        ? "#B91C1C"
        : "hsl(var(--foreground))";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-2 px-2 py-1.5 rounded-md text-left hover:bg-accent cursor-pointer transition-colors"
    >
      <Icon
        className="size-3.5 shrink-0 mt-0.5"
        style={{ color }}
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[12px]" style={{ fontWeight: 500, color }}>
          {label}
        </span>
        {hint && (
          <span
            className="text-[10.5px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}
