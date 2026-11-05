/* ═══════════════════════════════════════════════════════════════
   PLANNER GAP GRAPH — projected-inventory chart (Recharts)

   One slate line = projected on-hand (ATP), stepped at each event, against
   muted dashed Min / Max / Zero reference lines and a Need-by marker. The line
   dipping under Min IS the gap; allocate vendors and the line lifts back above.

   EVENTS — the redesign. Detail no longer lives crammed onto the plot. Instead:

     · A compact, FIXED-FOOTPRINT cluster marker sits on the curve at each
       event-day (dots view): a single coloured dot for one event, a colour-
       segmented pill for a few (so "SO + PO + vendor" reads at a glance), or a
       "×N" badge for many. It never overlaps, no matter how dense the day.
     · The full detail lives in ONE rich card, shown on hover (dots view) or
       persistently with collision-avoidance (cards view). Each card lists every
       event for the day — SO/PR (−qty), incoming PO (+qty), and planned vendors
       with their LOGO + units + on-time/late — so the picture is complete.

   The card + the dots/cards toggle are driven by a single HTML overlay laid
   over the Recharts plot, positioned from the chart's own scales (captured via
   a <Customized> probe). The SVG keeps drawing the curve / axes / grid /
   reference lines / breach call-outs.

   INTERACTION — any day is a create target. Hovering any day draws a guide +
   "click to add" affordance; clicking opens a chooser split into two sections:
   "Plan a purchase order" (Purchase from a qualified vendor — the default — or
   Show all vendors, buying outside the qualified list) and a grouped "Simulate"
   area (Simulate Supply · Simulate Demand). The simulate paths seed a (locked-
   flow) form; the plan path opens the same vendor cards as the side panel,
   scoped to the qualified set or the full marketplace.

   Presentational: the parent owns state, recomputes the curve + events, and
   passes them down. `onSimulateAdd` routes a what-if to the parent's mock-event
   handler; `onPlotVendor` plots the chosen vendor (qualified or not) at a qty.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Pencil as PencilIcon, Plus, Trash2, CalendarDays, ExternalLink, Search, X } from "lucide-react";
import { type TransactionDirection } from "./UnifiedTransactionStream";
import PlannerAddChooser from "./PlannerAddChooser";
import { type SupplyPlanWizardHandle } from "./SupplyPlanWizard";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Customized,
} from "recharts";
import { vendorConstraints, type PlannerItem, type PlannerVendor, type PlanMode } from "./plannerData";
import { SHOW_PURCHASE_REQUESTS_IN_PLANNER } from "./procurementPlanningParams";
import {
  recommendedQtyFromItemMaster,
  useRecommendationMode,
  type QtyRecommendation,
} from "./plannerRecommendationStore";
import { effectivePrice } from "../utils/projection";
import { sourceDocHref } from "./plannerData";
import type { ProjectionPoint } from "../utils/projection";
import { VendorLogo } from "./vendorLogo";
import PlannerPricingRuleBadge from "./PlannerPricingRuleBadge";

/* ── Public event shape (effective values, overrides already applied) ── */
export interface GapGraphEvent {
  id: string;
  kind: "demand" | "incoming" | "proposed";
  label: string;
  sublabel?: string;
  /** Magnitude (always positive). Direction comes from `kind`. */
  qty: number;
  /** Effective day offset from today (0 = today), clamped to the horizon.
      For a planned PO this is the RECEIVING day (where the curve lifts). */
  day: number;
  /** Planned PO only: the day the ORDER is placed (= receiving − lead time).
      Drawn as a non-lifting hollow marker linked to the receiving point. */
  orderDay?: number;
  excluded: boolean;
  /** Tentative (draft SO) — rendered hollow. */
  draft?: boolean;
  /** A DRAFT purchase order — a display-only hollow-green "Draft PO" marker.
      NEVER counted in the projected curve (a draft hasn't promised anything). */
  draftPO?: boolean;
  /** Predicted "what-if" event the buyer added by hand. */
  mock?: boolean;
  /** Auto-generated supply from the item's recommendation mode (zero / min /
      max). Rendered as a dashed hollow ring so buyers can tell auto-fills
      apart from their own simulations; not draggable, not removable. */
  autoRecommendation?: boolean;
  /** Demand sub-type: "SO" | "REQ" | "LOW" — drives the dot colour. */
  tag?: string;
  /** Reorder-point alert (LowStock) — non-consuming, ignored by the curve. */
  signal?: boolean;
  /** Who created this entry — only set for Draft POs. Rendered as a person
      avatar on the draft row so the buyer sees who drafted it. */
  createdBy?: string;
}

interface PlannerGapGraphProps {
  item: PlannerItem;
  /** Effective projected curve (parent computed it from the overrides). */
  curve: ProjectionPoint[];
  /** Baseline curve (kept for interface compatibility; not drawn). */
  baselineCurve?: ProjectionPoint[];
  events: GapGraphEvent[];
  horizonDays: number;
  /** Left edge of the visible window (day offset from today; 0 = today). */
  startDay?: number;
  /** Fill the parent's height (flex column, chart flex-1) instead of the
      viewport-derived height — used in the resizable sandbox grid panel. */
  fillHeight?: boolean;
  /** Snapshot-view read-only lock (buyer feedback 2026-07-20). When true,
      every mutation (drag-to-reschedule, click-to-add, plot vendor, add/
      remove/exclude event) is frozen. Non-mutating affordances — hover,
      tooltips, scroll — stay live. Callers should ALSO pass undefined for
      the mutation callbacks; this prop is the belt-and-braces for
      always-active drag pointer handlers that don't gate on callback
      presence. */
  viewOnly?: boolean;
  /** First day the curve breaches min, or null — drawn as the need-by anchor.
      Reflects the manual override when the buyer has set one. */
  deadlineDay: number | null;
  /** Units needed to bring the item back to its minimum — forwarded to the
      chooser so a planned PO defaults to a bring-to-minimum quantity. */
  unitsToCover?: number;
  /** Set the need-by day manually (drag the line / pick in its pill calendar);
      pass null to clear the override back to the auto-detected shortage. Omit to
      make the need-by line read-only. */
  onNeedByChange?: (day: number | null) => void;
  /** Whether the current need-by is a manual override — enables "reset to auto". */
  needByIsManual?: boolean;
  /** The auto-detected need-by (first shortage), shown on the reset affordance. */
  needByAutoDay?: number | null;
  /** Order-by anchor day — INDEPENDENT of need-by (its own draggable line). */
  orderByDay?: number | null;
  /** Set the order-by day manually; null clears the override back to auto. Omit
      to make the order-by line read-only. */
  onOrderByChange?: (day: number | null) => void;
  /** Whether order-by is a manual override — enables its "reset to auto". */
  orderByIsManual?: boolean;
  /** The auto order-by (a lead time before the auto deadline), for its reset. */
  orderByAutoDay?: number | null;
  /** Recommended vendor lead time — seeds the order-by auto position + calendar
      hints only; the two lines are otherwise independent. */
  recommendedLeadDays?: number | null;
  onMoveEvent: (id: string, newDay: number) => void;
  onToggleEvent: (id: string) => void;
  showEvents?: boolean;
  /** Add a simulated what-if (demand or supply) from a plot click. Mirrors the
      Transaction Table's Simulate-entry payload so the same form drives both. */
  onSimulateAdd?: (data: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => void;
  /** Qualified vendors offered in the chooser's "Purchase from a qualified
      vendor" path (the default, recommended set). */
  vendors?: PlannerVendor[];
  /** The full marketplace — qualified vendors PLUS non-qualified pool vendors —
      offered in the chooser's "Show all vendors" path. Falls back to `vendors`
      when absent. */
  allVendors?: PlannerVendor[];
  /** Plot a chosen vendor as a planned PO. `plan.mode` tells the host whether
      the clicked day is the order date ("orderOn") or the need-by date
      ("needBy"), so it can derive both the order and the arrival days. */
  onPlotVendor?: (
    vendorId: string,
    day: number,
    qty: number,
    plan?: { mode: PlanMode },
  ) => void;
  /** Hover bridge — the day offset under the cursor (0 = today), or null. The
      workspace uses it to highlight matching Transaction Table rows. */
  onHoverDay?: (day: number | null) => void;
  /** Req #6 — REVERSE hover bridge. A day offset (0 = today) the PARENT wants
      surfaced on the graph (e.g. a Transaction-Table row the user is hovering),
      or null/undefined for "no external hover". The graph's own pointer hover
      always wins; this only drives the hover day-card when the internal pointer
      isn't already over a day. Purely additive — when omitted the graph behaves
      exactly as before. */
  externalHoverDay?: number | null;
  /** Fully remove ONE plotted hypothetical (a planned vendor PO or a simulated
      what-if) by its event id — not just hide it. Routed by id prefix in the
      parent. Omit to hide the per-entry remove control. */
  onRemoveEvent?: (id: string) => void;
  /** Remove EVERY plotted hypothetical at once (all sim what-ifs + vendor
      plots). Omit to hide the "Clear added" control. */
  onClearProposedPOs?: () => void;
  onClearSimulations?: () => void;
  onClearAll?: () => void;
  /** Controlled "Draft purchase orders" toggle — when both are
      provided, the draft chip in the legend drives the SAME state
      as the Transaction Table's "Draft POs" pill (via the
      workspace). Turning it off in either place hides drafts from
      the graph AND the table AND the projected curve. Omit both to
      keep the legacy local-only `hiddenKinds.has("draft")` behaviour. */
  showDrafts?: boolean;
  onShowDraftsChange?: (next: boolean) => void;
  /** Optional one-line note pinned to the top-left of the plot area.
      Buyer feedback 2026-07-20: in Auto mode, when the buyer has
      also added their own planned POs, surface a small note so
      they can tell the plotted POs aren't all from Auto. Kept to a
      single line with no em-dash per the same feedback. */
  topLeftNote?: string | null;
  /** Edit-in-place request from the host (buyer feedback 2026-07-20).
      When set, the graph auto-opens the SupplyPlanWizard at the
      target day with the pre-filled vendor + qty so the buyer can
      change either. Cleared by the host after commit / cancel. */
  editingSupplyRequest?: {
    id: string;
    vendorId: string;
    qty: number;
    arrivalDay: number;
  } | null;
  /** Fires when the buyer cancels an in-progress edit — lets the
      host clear its editing state so subsequent plots don't get
      routed as replacements. */
  onEditSupplyCancel?: () => void;
  /** Fires when the buyer clicks Edit on a plotted event in the
      graph's day-card. Host handles by populating
      `editingSupplyRequest` on the next render (host also stores
      an internal id used by plotVendorAt to replace the plot). */
  onEditSupplyRequested?: (eventId: string) => void;
}

/* ── Colours ── */
const C_LINE = "#475569"; // slate — projected inventory line + area
const C_GRID = "#EEF2F6";
const C_DEADLINE = "#334155"; // need-by anchor (neutral slate)
const C_ORDERBY = "#5B6B8C"; // order-by anchor — subtle dusty slate-blue, distinct from need-by

/* Threshold guardrail tones — kept identical to the Transaction Table's stock
   bands (UnifiedTransactionStream: below-max slate · below-min amber · below-
   zero red) so a colour means the SAME thing on the graph and in the table. */
const C_MAX = "#94A3B8"; // ceiling — muted slate (least urgent)
const C_MIN = "#D97706"; // reorder floor — amber
const C_ZERO = "#DC2626"; // stockout — red

/* Two positive flows, two colours — so supply and a planned vendor never blur
   together (and to match the table + add-chooser, which already split them):
     · C_SUPPLY (green) = stock already coming back up — incoming POs on the
       books + simulated supply what-ifs. Mirrors the table's receiving-green.
     · C_VENDOR (blue)  = a vendor the buyer is planning to purchase from
       (a proposed PO). Mirrors the table's "PLANNED" blue badge and the
       chooser's TONE_VENDOR. */
const C_SUPPLY = "#059669";
const C_VENDOR = "#2563EB";

/* On-curve dot taxonomy + colour key. */
type DotType = "so" | "pr" | "incoming" | "draft" | "proposed";
const DOT_TYPES: DotType[] = ["so", "pr", "incoming", "draft", "proposed"];
const DOT_TONE: Record<DotType, { fill: string; label: string }> = {
  so: { fill: "#DC2626", label: "Sales orders" },
  pr: { fill: "#EA580C", label: "Purchase requests" },
  /* Eli 2026-07-09: "PO Receipt" is AI-invented and wrong — this is a
     FUTURE projection, not a receiving. The source document is a
     Purchase order. Also: spell "Purchase order" out consistently
     with "Sales order" instead of abbreviating "PO". */
  incoming: { fill: C_SUPPLY, label: "Purchase orders" },
  /* Draft — same supply-green as incoming, but always rendered HOLLOW
     (dashed) to read as "in the pipeline, not committed". */
  draft: { fill: C_SUPPLY, label: "Draft purchase orders" },
  proposed: { fill: C_VENDOR, label: "Planned purchase orders" },
};
function dotTypeOf(ev: GapGraphEvent): DotType {
  if (ev.draftPO) return "draft";
  if (ev.kind === "incoming") return "incoming";
  if (ev.kind === "proposed") return "proposed";
  return ev.tag === "SO" ? "so" : "pr";
}
/* The dot/segment colour for an event — what-ifs colour by flow (demand red /
   supply green) so they read against the four solid types. */
function eventTone(e: GapGraphEvent): string {
  if (e.mock) return e.kind === "demand" ? DOT_TONE.so.fill : DOT_TONE.incoming.fill;
  return DOT_TONE[dotTypeOf(e)].fill;
}
/* An entry the buyer CREATED on the graph — a planned vendor (proposed) or any
   simulated what-if, supply OR demand. These all render as the prominent ringed
   "+" marker (the "+" signals user-added + interactive) and are click-to-open;
   the most-recent one also pulses (see justAddedIds). The marker keeps the
   event's own tone, so a what-if demand stays red, supply (real or simulated)
   stays green, and a planned vendor reads blue — "+" means "you added this",
   colour still means which flow. */
function isUserAddedEvent(e: GapGraphEvent): boolean {
  return e.kind === "proposed" || !!e.mock;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtRealDate(iso?: string): string {
  if (!iso) return "";
  const parts = iso.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return "";
  return `${MONTHS[m - 1]} ${d}`;
}
/* Day offset (0 = today) ⇄ Date for the inline need-by calendar; local Y/M/D so
   the round-trip never shifts a day across a timezone. `fmtDayDate` labels a day
   even when it's outside the projected curve (e.g. an order-by date in the
   past), where `dateByDay` has no entry. */
function dayToDateLocal(day: number): Date {
  const dt = new Date();
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + Math.round(day));
  return dt;
}
function dayFromDateLocal(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const picked = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((picked.getTime() - today.getTime()) / 86_400_000);
}
function fmtDayDate(day: number): string {
  const dt = dayToDateLocal(day);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

/* ── Plot geometry captured from Recharts' own scales (see ScaleCapture) ── */
interface PlotGeom {
  xScale: (v: number) => number;
  yScale: (v: number) => number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/* ═══ DAY-DETAIL CARD — the rich, complete per-day surface ════════════════
   Shared by the hover overlay (dots view) and the persistent cards (cards
   view). Header = date + projected on-hand (with the below-min read-out); body
   = one row per event, fully spelled out. */
function DayEventRow({
  e,
  baseUom,
  vendorByName,
  deadlineDay,
  onRemove,
  onEdit,
}: {
  e: GapGraphEvent;
  baseUom: string;
  vendorByName: Map<string, PlannerVendor>;
  deadlineDay: number | null;
  /** When set, the row shows a trash control that fully removes this entry
      (only wired for user-added entries in interactive cards). */
  onRemove?: () => void;
  /** When set, the row shows a pencil control that re-opens the plot in the
      wizard so the buyer can change vendor / qty / date. Buyer feedback
      2026-07-20: "edit instead of re-plot". */
  onEdit?: () => void;
}) {
  const isSim = !!e.mock;
  /* Trash control — shared by both row layouts; stops propagation so it never
     also triggers the card's click-to-add wrapper. */
  const removeBtn = onRemove ? (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onRemove();
      }}
      title="Remove this entry from the graph"
      aria-label="Remove this entry"
      className="grid size-5 shrink-0 place-items-center rounded text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
    >
      <Trash2 className="size-3.5" />
    </button>
  ) : null;
  const editBtn = onEdit ? (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onEdit();
      }}
      title="Edit this plotted supply"
      aria-label="Edit this plotted supply"
      className="grid size-5 shrink-0 place-items-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <PencilIcon className="size-3.5" />
    </button>
  ) : null;

  /* Planned vendor — 3-column layout (buyer 2026-07-23: match the
     SO/PO row style so all rows read as the same card family). Icon
     tile with vendor logo, bold vendor name + PLANNED chip up top,
     subtitle strip carries timing + date + pricing badges, right
     column holds the qty + edit/delete affordances. */
  if (e.kind === "proposed") {
    const v = vendorByName.get(e.label);
    const late = deadlineDay != null && e.day > deadlineDay;
    const early = v != null && e.day < v.leadTimeDays;
    return (
      <div className="flex items-start gap-2">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-md"
          style={{
            width: "calc(28px * var(--gs, 1))",
            height: "calc(28px * var(--gs, 1))",
            backgroundColor: "#EFF6FF",
            border: "1px solid #BFDBFE",
          }}
          aria-hidden
        >
          <VendorLogo name={e.label} id={v?.vendorId ?? e.label} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold text-slate-800" style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}>{e.label}</span>
            <span
              className="inline-flex shrink-0 items-center rounded-md border px-1 py-[1px] font-semibold uppercase tracking-wide"
              style={{
                fontSize: "calc(8.5px * var(--gs, 1))",
                letterSpacing: "0.05em",
                color: DOT_TONE.proposed.fill,
                backgroundColor: "#EFF6FF",
                borderColor: "#BFDBFE",
              }}
            >
              Planned
            </span>
          </div>
          <div className="truncate text-slate-500" style={{ fontSize: "calc(10px * var(--gs, 1))", marginTop: 1 }}>
            {late ? (
              <span style={{ color: "#B91C1C" }}>arrives late</span>
            ) : early ? (
              <span style={{ color: "#B45309" }} title={`Arrives before this vendor's ${v!.leadTimeDays}-day lead time`}>before lead time</span>
            ) : (
              <span style={{ color: "#15803D" }}>on time</span>
            )}
            <span className="text-slate-400"> · {fmtDayDate(e.day)}</span>
          </div>
          {v && v.pricingRules.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {v.pricingRules.map((r, i) => (
                <PlannerPricingRuleBadge key={i} rule={r} uom={baseUom} />
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right flex items-start gap-1">
          <span
            className="font-semibold tabular-nums"
            style={{ fontSize: "calc(11.5px * var(--gs, 1))", color: DOT_TONE.proposed.fill }}
          >
            +{e.qty.toLocaleString()} {baseUom}
          </span>
          {(editBtn || removeBtn) && (
            <div className="flex items-center gap-0.5">
              {editBtn}
              {removeBtn}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Draft PO — buyer 2026-07-19: "show only necessary info; match
     what we have for draft PO on the purchase order listing table".
     Collapsed to one compact line that mirrors the surrounding event
     rows (dashed dot · link · qty), with a small "Draft" badge using
     the exact same status tokens as the PO listing's StatusBadge.
     Dropped the vendor logo, creator initials avatar, vendor-name
     secondary line, and lead-time detail — all noise for this
     surface. Buyer can click through to the PO for those details. */
  if (e.draftPO) {
    const poNumber = e.sublabel; // draft PO's poNumber rides as sublabel
    const href = poNumber ? `/purchase-orders/${poNumber}` : undefined;
    const label = poNumber ?? e.label;
    /* Green tokens for the Draft PO badge (buyer 2026-07-19: "green
       color"). Emerald palette — matches the DOT_TONE.draft fill on
       the graph so the row's dot, chip color, and badge all read as
       the same "draft" tone. Deliberately not `getStatusBadgeCss` here
       because that palette is neutral-gray. */
    const draftStyle: React.CSSProperties = {
      backgroundColor: "#ECFDF5", // emerald-50
      color: "#047857", // emerald-700
      borderColor: "#A7F3D0", // emerald-200
    };
    const linkInner = (
      <>
        <span className="truncate">{label}</span>
        <ExternalLink className="size-3 shrink-0 opacity-60" />
      </>
    );
    return (
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: "#FFFFFF", border: `1.5px dashed ${DOT_TONE.draft.fill}` }}
        />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            title={`Open ${poNumber}`}
            className="flex min-w-0 flex-1 items-center gap-1 font-medium text-slate-700 transition-colors hover:text-primary hover:underline"
            style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}
          >
            {linkInner}
          </a>
        ) : (
          <div
            className="min-w-0 flex-1 truncate font-medium text-slate-700"
            style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}
          >
            {label}
          </div>
        )}
        <span
          className="inline-flex shrink-0 items-center rounded-md border px-1 py-0 font-medium"
          style={{
            fontSize: "calc(9px * var(--gs, 1))",
            lineHeight: 1.4,
            ...draftStyle,
          }}
        >
          Draft PO
        </span>
        <span
          className="shrink-0 font-semibold tabular-nums text-slate-700"
          style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}
        >
          +{e.qty.toLocaleString()} {baseUom}
        </span>
        {removeBtn}
      </div>
    );
  }

  /* Demand (SO / request) or incoming PO, plus what-ifs of either flow.
     Row style upgraded 2026-07-23 to mirror the Vendor Invoicing mini-
     card (buyer + Eli reference): tinted icon tile with type initial,
     bold label + subtitle line for context, right-column bold qty +
     secondary tag. Same source-doc link as before via the row-level
     anchor when a doc exists; the whole row surface stays clickable so
     you can hit the card anywhere. */
  const tone = eventTone(e);
  const hollow = isSim || !!e.draft || !!e.draftPO;
  const sign = e.kind === "demand" ? "−" : "+";
  const docHref =
    e.tag === "SO"
      ? sourceDocHref("SO", e.label)
      : e.tag === "REQ"
        ? sourceDocHref("Request", e.label)
        : null;
  /* Row descriptor — what type of event this is, in plain English.
     Kept short so it fits the subtitle without wrap. */
  const typeSubtitle =
    e.tag === "SO"
      ? "Sales order"
      : e.tag === "REQ"
        ? "Purchase request"
        : e.tag === "LOW"
          ? "Low-stock signal"
          : e.kind === "demand"
            ? "Demand"
            : e.kind === "incoming"
              ? "Incoming PO"
              : "Event";
  /* Icon tile — single-letter initial from the tag / kind, coloured
     to match the dot. Rounded square (like the invoicing row's image
     tile) instead of just a dot; carries the same signal but with more
     visual weight so the row reads as a card, not a list item. */
  const iconInitial =
    e.tag === "SO"
      ? "S"
      : e.tag === "REQ"
        ? "R"
        : e.tag === "LOW"
          ? "L"
          : e.kind === "incoming"
            ? "P"
            : "•";
  const rowBody = (
    <>
      <div
        className="flex shrink-0 items-center justify-center rounded-md font-semibold"
        style={{
          width: "calc(28px * var(--gs, 1))",
          height: "calc(28px * var(--gs, 1))",
          backgroundColor: hollow ? "#FFFFFF" : `${tone}20`,
          color: tone,
          border: hollow ? `1.5px dashed ${tone}` : `1px solid ${tone}30`,
          fontSize: "calc(11px * var(--gs, 1))",
        }}
        aria-hidden
      >
        {iconInitial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span
            className="truncate font-semibold text-slate-800"
            style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}
          >
            {e.label}
          </span>
          {docHref && <ExternalLink className="size-3 shrink-0 opacity-60" />}
        </div>
        <div
          className="truncate text-slate-500"
          style={{ fontSize: "calc(10px * var(--gs, 1))", marginTop: 1 }}
        >
          {typeSubtitle}
          {e.sublabel && <span className="text-slate-400"> · {e.sublabel}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className="font-semibold tabular-nums"
          style={{ fontSize: "calc(11.5px * var(--gs, 1))", color: tone }}
        >
          {sign}
          {e.qty.toLocaleString()} {baseUom}
        </div>
        {isSim && (
          <div
            className="text-slate-400"
            style={{ fontSize: "calc(9.5px * var(--gs, 1))", marginTop: 1 }}
          >
            what-if
          </div>
        )}
      </div>
      {removeBtn}
    </>
  );
  return docHref ? (
    <a
      href={docHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(ev) => ev.stopPropagation()}
      title={`Open ${e.label}`}
      className="flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-slate-50"
    >
      {rowBody}
    </a>
  ) : (
    <div className="flex items-center gap-2">
      {rowBody}
    </div>
  );
}

function DayDetailCard({
  dateLabel,
  atp,
  baseUom,
  minLevel,
  events,
  vendorByName,
  deadlineDay,
  style,
  scroll = false,
  onRemoveEvent,
  onEditEvent,
  highlight,
  onMouseEnter,
  onMouseLeave,
  item,
  qualifiedVendors,
  onSuggestVendor,
  hoverDay,
}: {
  dateLabel: string;
  atp: number | undefined;
  baseUom: string;
  minLevel: number;
  events: GapGraphEvent[];
  vendorByName: Map<string, PlannerVendor>;
  deadlineDay: number | null;
  style?: React.CSSProperties;
  /** Allow the body to scroll (cards view — it owns pointer events). */
  scroll?: boolean;
  /** When set, user-added rows (vendor plots + what-ifs) show a trash control
      that fully removes the entry. Passed to every interactive card — the
      pinned card, the cards-view card, AND the hover card (made interactive via
      the hover-intent bridge so an entry can be deleted straight from hover). */
  onRemoveEvent?: (id: string) => void;
  /** When set, plotted extra POs get a pencil control that re-opens the
      wizard in edit mode. Buyer feedback 2026-07-20: edit-in-place. */
  onEditEvent?: (eventId: string) => void;
  /** Just-added emphasis ring — cards-view parity with the dot-view pulse. */
  highlight?: boolean;
  /** Hover-bridge handlers — keep the card alive while the pointer is on it. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Vendor-suggestion inputs (Rida/Areeb feedback): when a simulated SUPPLY
      event is on this day, the card renders a compact "Fulfill with a vendor"
      section — lead-time-aware, price-aware — so the buyer can go straight
      from "I need X on day D" to "here's who can deliver it." */
  item?: PlannerItem;
  qualifiedVendors?: PlannerVendor[];
  onSuggestVendor?: (
    vendorId: string,
    day: number,
    qty: number,
    plan?: { mode: PlanMode },
  ) => void;
  /** Day offset (from today) this card represents — used to size the vendor
      "fits in time" check against each vendor's lead time. */
  hoverDay?: number;
}) {
  /* Running shortfall at this day: how far the projected on-hand has fallen
     below the minimum, and (once negative) below zero — so moving across the
     dip surfaces the deepening deficit, not just a single snapshot. */
  const belowMin = atp != null && atp < minLevel;
  const belowZero = atp != null && atp < 0;
  const aboveMax = atp != null && atp > item.maxLevel;
  /* Busy days: cap the event list and reveal the rest behind "+N more" so a
     day with many demands reads cleanly instead of cramming / long scrolling. */
  const [expanded, setExpanded] = useState(false);
  const MAX_COLLAPSED = 5;
  /* Long-day search: 2026-07-14 buyer feedback — "57+ events days, add a
     search within". When the day carries at least SEARCH_THRESHOLD events
     a compact input appears above the list. Types match against label +
     sublabel + tag (case-insensitive). When search is active we also
     ignore MAX_COLLAPSED so every match is visible without an extra
     "show more" tap. */
  const SEARCH_THRESHOLD = 12;
  const [eventSearch, setEventSearch] = useState("");
  useEffect(() => {
    /* Reset the query whenever the card re-renders for a different day
       so a search left from Aug 12 doesn't leak into Aug 13's list. */
    setEventSearch("");
  }, [dateLabel]);
  const searchQ = eventSearch.trim().toLowerCase();
  const isSearching = searchQ.length > 0;
  const filteredEvents = useMemo(() => {
    if (!isSearching) return events;
    return events.filter((e) => {
      if (e.label.toLowerCase().includes(searchQ)) return true;
      if (e.sublabel && e.sublabel.toLowerCase().includes(searchQ)) return true;
      if (e.tag && e.tag.toLowerCase().includes(searchQ)) return true;
      return false;
    });
  }, [events, isSearching, searchQ]);
  const isOverflowing = !isSearching && filteredEvents.length > MAX_COLLAPSED + 1;
  const shownEvents =
    isSearching || expanded || !isOverflowing
      ? filteredEvents
      : filteredEvents.slice(0, MAX_COLLAPSED);
  const hiddenCount = filteredEvents.length - shownEvents.length;
  const showEventSearch = events.length >= SEARCH_THRESHOLD;

  /* Detect a simulated SUPPLY on this day → drive the vendor-suggestion
     section. Only one is expected in practice; if the buyer stacked multiple,
     the first wins (its qty seeds the suggestions). */
  const simSupply = events.find((e) => e.kind === "incoming" && e.mock);
  const showVendorSuggestions =
    !!simSupply && !!item && !!qualifiedVendors && qualifiedVendors.length > 0 && hoverDay != null;
  /* Suggested order quantity comes from the ITEM MASTER (not the vendor):
     mode → target level → shortfall vs projected on-hand → round up to
     multiples → floor at item MOQ → cap at item max. The buyer sees a
     short "Take to max · ×25 · MOQ 50" line so they know why. Buyer
     feedback 2026-07-14: "the suggested number must come from the item
     master rules — the UI must explain why." */
  const recMode = useRecommendationMode(item?.itemCode);
  const qtyRec: QtyRecommendation | null = useMemo(() => {
    if (!item || atp == null) return null;
    return recommendedQtyFromItemMaster(item, atp, recMode);
  }, [item, atp, recMode]);
  const suggestedQty = qtyRec?.qty ?? simSupply?.qty ?? 0;
  const vendorRows = useMemo(() => {
    if (!showVendorSuggestions || !item || !qualifiedVendors || hoverDay == null || !simSupply) return [];
    return qualifiedVendors
      .map((v) => {
        const c = vendorConstraints(item, v);
        const eff = effectivePrice(v.unitPrice, v.pricingRules, suggestedQty);
        return {
          v,
          eff,
          moq: c.moq,
          maxOrderQty: c.maxOrderQty,
          fits: v.leadTimeDays <= hoverDay,
        };
      })
      .sort((a, b) => {
        if (a.fits !== b.fits) return a.fits ? -1 : 1; // fits before late
        if (a.v.primaryFlag !== b.v.primaryFlag) return a.v.primaryFlag ? -1 : 1; // primary within group
        return a.eff - b.eff; // then cheapest first
      });
  }, [showVendorSuggestions, item, qualifiedVendors, hoverDay, simSupply, suggestedQty]);

  /* Two-state view for the vendor-suggestion section: click a vendor row to
     move to a compact "confirm timing" view with Just-in-time / Order-now
     radios BEFORE committing. Mirrors the SupplyPlanWizard Step 3 flow so
     the buyer picks timing here too — not just when planning from scratch. */
  const [pendingVendor, setPendingVendor] = useState<PlannerVendor | null>(null);
  const [pendingMode, setPendingMode] = useState<PlanMode>("needBy");
  const pendingTiming = useMemo(() => {
    if (!pendingVendor || hoverDay == null) return null;
    const lead = pendingVendor.leadTimeDays;
    const jitOrderDay = Math.max(0, hoverDay - lead);
    return {
      needBy: { orderDay: jitOrderDay, arrivalDay: hoverDay },
      orderOn: { orderDay: 0, arrivalDay: lead },
      canPickJit: jitOrderDay >= 0,
      earlyDays: hoverDay - lead,
      savings: jitOrderDay,
    };
  }, [pendingVendor, hoverDay]);
  const effectivePendingMode: PlanMode = pendingTiming?.canPickJit ? pendingMode : "orderOn";
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white shadow-lg ${
        highlight ? "border-[#0A77FF] ring-2 ring-[#0A77FF]" : "border-slate-200"
      }`}
      /* Widened from 14rem → 20rem (user feedback 2026-07-01: vendor names +
         MOQ range were cropping). Width kept in raw rem (no `--gs` multiplier)
         so shrinking labels doesn't shrink the card frame too — the extra
         space lets the vendor row breathe. */
      style={{ width: "20rem", ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      /* Defensive stopPropagation (buyer 2026-07-16: "clicking a dot
         doesn't keep the dialog / let you act on it"). Any click that
         lands inside the card is meant for the card, never for the
         chart-box safety-net onClick that closes the pinned card. */
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header — light, subtle. Buyer 2026-07-23: "no need for black
          background, too much clutter". Kept the small band-status
          pill (still useful signal) but dropped the dark navy strip;
          hierarchy now comes from typography and spacing alone. */}
      <div className="border-b border-slate-100 px-3 pt-2 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-slate-800" style={{ fontSize: "calc(12px * var(--gs, 1))" }}>{dateLabel}</div>
          {atp != null && (aboveMax || belowMin || belowZero) && (
            <span
              className="inline-flex items-center rounded-md font-semibold uppercase tracking-wide"
              style={{
                fontSize: "calc(9px * var(--gs, 1))",
                letterSpacing: "0.05em",
                padding: "2px 6px",
                backgroundColor: aboveMax ? "#F0FDFA" : belowZero ? "#FEF2F2" : "#FFFBEB",
                color: aboveMax ? "#0F766E" : belowZero ? "#B91C1C" : "#B45309",
              }}
            >
              {aboveMax ? "Overstock" : belowZero ? "Below zero" : "Below min"}
            </span>
          )}
        </div>
        {atp != null && (
          <>
            <div className="tabular-nums text-slate-600" style={{ fontSize: "calc(11px * var(--gs, 1))", marginTop: 2 }}>
              <span className="text-slate-500">On-hand</span>{" "}
              <span className="font-semibold text-slate-800">{Math.round(atp)} {baseUom}</span>
              <span className="text-slate-400"> · min {minLevel} · max {item.maxLevel}</span>
            </div>
            {(aboveMax || belowMin || belowZero) && (
              <div className="tabular-nums font-medium" style={{ fontSize: "calc(10.5px * var(--gs, 1))", marginTop: 2 }}>
                {aboveMax && (
                  <span style={{ color: "#0F766E" }}>{Math.round(atp - item.maxLevel)} above max</span>
                )}
                {aboveMax && (belowMin || belowZero) && <span className="text-slate-300"> · </span>}
                {belowMin && (
                  <span style={{ color: "#B45309" }}>{Math.round(minLevel - atp)} below min</span>
                )}
                {belowMin && belowZero && <span className="text-slate-300"> · </span>}
                {belowZero && (
                  <span style={{ color: "#DC2626" }}>{Math.round(-atp)} below zero</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {events.length === 0 ? (
        <div className="px-3 py-2 text-slate-400" style={{ fontSize: "calc(11px * var(--gs, 1))" }}>No events — click to add</div>
      ) : (
        <div className={`px-3 py-2 ${scroll ? "max-h-56 overflow-y-auto" : ""}`}>
          {showEventSearch && (
            /* Compact in-card search — matches the transaction table's
               toolbar search recipe (PlannerTransactionTable.tsx:1401
               → h-7 · text-[11.5px] · rounded-lg · shadow-sm · size-3
               icon at muted-foreground · size-4 clear pill). Same
               dimensions, so buyers see a familiar search pattern
               anywhere they look — hover card, tx table, tx modal. */
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3"
                style={{ color: "hsl(var(--muted-foreground))" }}
              />
              <input
                type="text"
                value={eventSearch}
                onChange={(ev) => setEventSearch(ev.target.value)}
                onClick={(ev) => ev.stopPropagation()}
                onMouseDown={(ev) => ev.stopPropagation()}
                placeholder={`Search ${events.length} events…`}
                aria-label="Search events on this day"
                maxLength={75}
                className="h-7 w-full rounded-lg border border-border pl-7 pr-7 text-[11.5px] shadow-sm outline-none transition-all placeholder:text-muted-foreground/70 hover:border-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/15"
                style={{
                  backgroundColor: "hsl(var(--input-background))",
                  color: "hsl(var(--foreground))",
                }}
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setEventSearch("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-4 rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            {shownEvents.length === 0 ? (
              <div className="py-1 text-slate-400" style={{ fontSize: "calc(11px * var(--gs, 1))" }}>
                No events match “{eventSearch}”
              </div>
            ) : (
              /* Grouped rendering (buyer 2026-07-23: "distinction ...
                 tells it is a fulfillment"). Split into DEMAND
                 (kind = "demand") and FULFILLMENT (everything else:
                 incoming POs, draft POs, planned vendor plots). Each
                 non-empty group gets a small uppercase divider label
                 so the flow types read distinctly. Divider omitted
                 when only one group is present. */
              (() => {
                const demand = shownEvents.filter((e) => e.kind === "demand");
                const fulfillment = shownEvents.filter((e) => e.kind !== "demand");
                const showHeaders = demand.length > 0 && fulfillment.length > 0;
                const renderRow = (e: GapGraphEvent) => (
                  <DayEventRow
                    key={e.id}
                    e={e}
                    baseUom={baseUom}
                    vendorByName={vendorByName}
                    deadlineDay={deadlineDay}
                    onRemove={
                      onRemoveEvent && isUserAddedEvent(e) ? () => onRemoveEvent(e.id) : undefined
                    }
                    onEdit={
                      onEditEvent && e.kind === "proposed" && e.id.startsWith("extrapo-")
                        ? () => onEditEvent(e.id)
                        : undefined
                    }
                  />
                );
                const label = (text: string) => (
                  <div
                    className="flex items-center gap-2 pt-1 pb-0.5 font-semibold uppercase tracking-wide text-slate-400"
                    style={{ fontSize: "calc(9px * var(--gs, 1))", letterSpacing: "0.06em" }}
                  >
                    <span>{text}</span>
                    <span className="flex-1 border-t border-slate-100" />
                  </div>
                );
                return (
                  <>
                    {showHeaders && demand.length > 0 && label("Demand")}
                    {demand.map(renderRow)}
                    {showHeaders && fulfillment.length > 0 && label("Fulfillment")}
                    {fulfillment.map(renderRow)}
                  </>
                );
              })()
            )}
            {isOverflowing && (
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setExpanded((x) => !x);
                }}
                className="w-full rounded px-1 py-1 text-left font-semibold text-[#0A77FF] transition-colors hover:bg-[#0A77FF]/[0.06]"
                style={{ fontSize: "calc(10.5px * var(--gs, 1))" }}
              >
                {expanded ? "Show less" : `+${hiddenCount} more`}
              </button>
            )}
            {isSearching && filteredEvents.length > 0 && (
              <div
                className="pt-0.5 text-slate-400"
                style={{ fontSize: "calc(10px * var(--gs, 1))" }}
              >
                {filteredEvents.length} of {events.length} shown
              </div>
            )}
          </div>
        </div>
      )}
      {showVendorSuggestions && vendorRows.length > 0 && simSupply && hoverDay != null && (
        <div className="border-t border-slate-100 px-3 py-2">
          {pendingVendor == null ? (
            <>
              <div
                className="mb-0.5 font-semibold uppercase tracking-wide text-slate-500"
                style={{ fontSize: "calc(9.5px * var(--gs, 1))", letterSpacing: "0.04em" }}
              >
                Create a PO to fulfill this
              </div>
              <div className="mb-1.5 text-slate-400" style={{ fontSize: "calc(10px * var(--gs, 1))" }}>
                Picking a vendor replaces this simulation with a planned PO.
              </div>
              <div className="space-y-1">
                {vendorRows.slice(0, 5).map(({ v, eff, moq, maxOrderQty, fits }) => (
                  <button
                    key={v.vendorId}
                    type="button"
                    disabled={!fits || !onSuggestVendor}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (!onSuggestVendor || !fits) return;
                      /* Stage the vendor pick — the confirm view below lets the
                         buyer choose JIT vs Order-now BEFORE the sim is
                         replaced with a real PO. */
                      setPendingVendor(v);
                      setPendingMode("needBy");
                    }}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                      fits
                        ? "border-slate-200 hover:border-[#0A77FF] hover:bg-[#0A77FF]/[0.04] cursor-pointer"
                        : "border-slate-100 bg-slate-50/50 cursor-not-allowed opacity-60"
                    }`}
                    title={
                      !fits
                        ? `Won't arrive in time — ${v.leadTimeDays}-day lead exceeds ${hoverDay} days`
                        : `Pick ${v.vendorName} → choose order timing`
                    }
                  >
                    <VendorLogo name={v.vendorName} id={v.vendorId} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate font-semibold text-slate-800" style={{ fontSize: "calc(11px * var(--gs, 1))" }}>
                          {v.vendorName}
                        </span>
                        {v.primaryFlag && (
                          <span
                            className="inline-flex shrink-0 items-center rounded-full px-1 py-[1px] font-semibold uppercase tracking-wide"
                            style={{
                              fontSize: "calc(8px * var(--gs, 1))",
                              letterSpacing: "0.05em",
                              color: "#0A77FF",
                              backgroundColor: "#EFF6FF",
                            }}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-0.5 flex items-center gap-2 text-slate-500 tabular-nums"
                        style={{ fontSize: "calc(10px * var(--gs, 1))" }}
                      >
                        <span className={fits ? "text-emerald-700" : "text-rose-600"}>
                          {v.leadTimeDays}d lead {fits ? "✓" : "✗"}
                        </span>
                        <span>·</span>
                        <span>${eff.toFixed(2)}/{baseUom}</span>
                        {(moq > 0 || maxOrderQty > 0) && (
                          <>
                            <span>·</span>
                            <span>MOQ {moq}–{maxOrderQty}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {vendorRows.length > 5 && (
                <div
                  className="mt-1 text-center text-slate-400"
                  style={{ fontSize: "calc(10px * var(--gs, 1))" }}
                >
                  +{vendorRows.length - 5} more vendors — use the click-to-add popover
                </div>
              )}
            </>
          ) : (
            /* Confirm timing view — picked vendor + JIT/Order-now radios +
               Plot button. Back returns to the vendor list. */
            pendingTiming && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingVendor(null); }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    title="Back to vendor list"
                  >
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <VendorLogo name={pendingVendor.vendorName} id={pendingVendor.vendorId} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-semibold text-slate-800" style={{ fontSize: "calc(11.5px * var(--gs, 1))" }}>
                        {pendingVendor.vendorName}
                      </span>
                      {pendingVendor.primaryFlag && (
                        <span
                          className="inline-flex shrink-0 items-center rounded-full px-1 py-[1px] font-semibold uppercase tracking-wide"
                          style={{
                            fontSize: "calc(8px * var(--gs, 1))",
                            letterSpacing: "0.05em",
                            color: "#0A77FF",
                            backgroundColor: "#EFF6FF",
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500" style={{ fontSize: "calc(10px * var(--gs, 1))" }}>
                      <Clock className="size-2.5" />
                      {pendingVendor.leadTimeDays}-day lead
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[
                    {
                      mode: "needBy" as const,
                      label: "Just in time",
                      hint: "Order later so capital stays free until the last moment.",
                      hidden: !pendingTiming.canPickJit,
                    },
                    {
                      mode: "orderOn" as const,
                      label: "Order now",
                      hint: pendingTiming.canPickJit
                        ? "Order today; stock arrives lead-time later, before it's needed."
                        : "Only option — lead time doesn't fit an earlier arrival.",
                      hidden: false,
                    },
                  ]
                    .filter((o) => !o.hidden)
                    .map((opt) => {
                      const active = effectivePendingMode === opt.mode;
                      return (
                        <label
                          key={opt.mode}
                          className={`flex w-full cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                            active
                              ? "border-[#0A77FF] bg-[#EFF6FF]"
                              : "border-slate-200 hover:border-[#0A77FF] hover:bg-[#0A77FF]/[0.04]"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="radio"
                            name="daycard-timing"
                            checked={active}
                            onChange={() => setPendingMode(opt.mode)}
                            className="sr-only"
                          />
                          <span
                            className={`mt-[2px] flex size-3 shrink-0 items-center justify-center rounded-full border-2 ${
                              active ? "border-[#0A77FF]" : "border-slate-300"
                            }`}
                          >
                            {active && <span className="block size-1 rounded-full bg-[#0A77FF]" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-slate-800" style={{ fontSize: "calc(11px * var(--gs, 1))" }}>
                              {opt.label}
                            </span>
                            <span
                              className="mt-0.5 block text-slate-500 leading-snug"
                              style={{ fontSize: "calc(10px * var(--gs, 1))" }}
                            >
                              {opt.hint}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                </div>
                <div
                  className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-100 bg-[#ECFDF5] px-2 py-1 text-emerald-700"
                  style={{ fontSize: "calc(10.5px * var(--gs, 1))" }}
                >
                  <Check className="size-3" />
                  <span className="truncate">
                    arrives day{" "}
                    <span className="font-semibold">
                      +{pendingTiming[effectivePendingMode].arrivalDay}
                    </span>
                    {" · order day "}
                    <span className="font-semibold">
                      +{pendingTiming[effectivePendingMode].orderDay}
                    </span>
                    {effectivePendingMode === "needBy" && pendingTiming.savings > 0 && (
                      <span className="ml-1 text-emerald-600/80">
                        · frees {pendingTiming.savings}d
                      </span>
                    )}
                  </span>
                </div>
                {/* Item-master recommended qty — surfaced BEFORE the
                    Plot button so the buyer sees the derivation, not
                    just a number. The chip carries a title with the
                    full derivation (bring to target → shortfall →
                    round → MOQ → cap) so buyers can drill in. */}
                {qtyRec && (
                  <div
                    className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                    style={{ fontSize: "calc(10.5px * var(--gs, 1))" }}
                    title={qtyRec.detailedReason.join("\n")}
                    aria-label={qtyRec.detailedReason.join(". ")}
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-500">
                      {qtyRec.reason}
                    </span>
                    <span className="font-semibold text-slate-800 tabular-nums shrink-0">
                      {qtyRec.qty} {baseUom}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!onSuggestVendor) return;
                    onSuggestVendor(pendingVendor.vendorId, hoverDay, suggestedQty, {
                      mode: effectivePendingMode,
                    });
                    if (onRemoveEvent && !simSupply.autoRecommendation) {
                      onRemoveEvent(simSupply.id);
                    }
                    setPendingVendor(null);
                  }}
                  className="mt-2 h-7 w-full rounded-md text-white font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#0A77FF", fontSize: "calc(11px * var(--gs, 1))" }}
                >
                  Plot {suggestedQty} {baseUom}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ── Cards-view layout helpers ── */
const CARD_W = 188; // consolidated day-card width (cards view)
const CHIP_W = 96; // condensed chip width (dense horizons)
const CHIP_H = 24;
const LANE_GAP = 16; // horizontal breathing room between cards sharing a lane
const LANE_VGAP = 14; // vertical breathing room between stacked card lanes

/** Estimate a consolidated card's pixel height from its events (controls the
    rendered height too, so lanes never overlap). */
function estimateCardHeight(events: GapGraphEvent[], vendorByName: Map<string, PlannerVendor>): number {
  let body = 0;
  for (const e of events) {
    if (e.kind === "proposed") {
      const hasRules = (vendorByName.get(e.label)?.pricingRules.length ?? 0) > 0;
      body += hasRules ? 56 : 38;
    } else {
      body += 20;
    }
  }
  return Math.min(216, 30 /* header */ + body + 10 /* pad */);
}

/** Greedy lane packing: assign each card (by ascending x) the lowest lane whose
    last card clears it. Returns a lane index per item + total lane count. */
function packLanes(xs: number[], cardW: number, gap: number = LANE_GAP): { lanes: number[]; laneCount: number } {
  const laneRight: number[] = [];
  const lanes: number[] = [];
  for (const x of xs) {
    let lane = -1;
    for (let i = 0; i < laneRight.length; i++) {
      if (laneRight[i] + gap <= x) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneRight.length;
      laneRight.push(0);
    }
    laneRight[lane] = x + cardW;
    lanes.push(lane);
  }
  return { lanes, laneCount: laneRight.length };
}

export default function PlannerGapGraph({
  item,
  curve,
  baselineCurve,
  events,
  horizonDays,
  startDay = 0,
  fillHeight = false,
  viewOnly = false,
  deadlineDay,
  unitsToCover = 0,
  onNeedByChange,
  needByIsManual = false,
  needByAutoDay = null,
  orderByDay = null,
  onOrderByChange,
  orderByIsManual = false,
  orderByAutoDay = null,
  recommendedLeadDays = null,
  onSimulateAdd,
  vendors,
  allVendors,
  onPlotVendor,
  onHoverDay,
  externalHoverDay, // req #6 — parent-driven hover day (Transaction-Table row → graph card)
  onRemoveEvent,
  onClearProposedPOs,
  onClearSimulations,
  onClearAll,
  showDrafts: showDraftsProp,
  onShowDraftsChange,
  topLeftNote = null,
  editingSupplyRequest = null,
  onEditSupplyCancel,
  onEditSupplyRequested,
}: PlannerGapGraphProps) {
  /* Event types the buyer has hidden via the colour-key toggles. */
  const [hiddenKinds, setHiddenKinds] = useState<Set<DotType>>(() => new Set());
  const toggleKind = (t: DotType) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  /* Simulated (what-if) markers — shown by default, toggleable from the key. */
  const [showSim, setShowSim] = useState(true);
  /* How events render: compact "dots" on the line (default) or persistent
     "cards". The dots/cards switch stays available in the header. */
  const [eventDisplay, setEventDisplay] = useState<"dots" | "cards">("dots");
  /* A planned (green) point whose detail card is pinned open. Click the point
     to open it; click the same point again (or add elsewhere) to close it. */
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);
  const togglePinned = (day: number) => setPinnedDay((p) => (p === day ? null : day));

  /* "Just-added" feedback. When the buyer commits an entry from the chooser we
     ARM a flag; the next render that brings a genuinely-new user-added event id
     (matched by presence, so vendor lead-time clamping doesn't matter) is the
     one they created — we pulse its marker and auto-open its card. Arming gates
     this so item loads / seeded data / drags never false-trigger. */
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(() => new Set());
  const armedRef = useRef(false);
  const prevEventsRef = useRef<{ code: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const code = item.itemCode;
    const curIds = new Set(events.map((e) => e.id));
    const prev = prevEventsRef.current;
    prevEventsRef.current = { code, ids: curIds };
    if (!prev || prev.code !== code) {
      // New item (or first render): baseline only, never highlight.
      armedRef.current = false;
      setJustAddedIds((s) => (s.size ? new Set() : s));
      return;
    }
    if (!armedRef.current) return; // only react right after an explicit create
    armedRef.current = false;
    const fresh = events.filter((e) => !prev.ids.has(e.id) && isUserAddedEvent(e));
    if (fresh.length) {
      setJustAddedIds(new Set(fresh.map((e) => e.id)));
      const last = fresh[fresh.length - 1];
      setPinnedDay(Math.max(0, Math.min(horizonDays, last.day)));
    }
  }, [events, item.itemCode, horizonDays]);

  /* Pending plot-click → the popover anchor (pixel position inside the chart
     box + the day clicked). The popover renders the shared PlannerAddChooser,
     which owns its own inner step / scope / selection state. */
  const [simAnchor, setSimAnchor] = useState<{ x: number; y: number; day: number } | null>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  /* The chooser popover renders in a body portal at fixed viewport coords
     anchored to a chart day. Once the page scrolls, those coords are stale and
     the card hangs over other sections — it belongs to the graph, so dismiss it
     on any scroll (capture phase, to catch whichever container scrolls) or a
     resize. Scrolls that originate INSIDE the card (its own vendor list) are
     ignored so the list stays scrollable. */
  const chooserWrapRef = useRef<HTMLDivElement>(null);
  /* Handle exposed by the Simulate-supply wizard when it's mounted;
     the overlay click routes through it so a dirty wizard can raise
     its own inline "Discard your simulation?" confirm instead of
     dismissing outright. Null when no wizard is up. */
  const supplyWizardHandleRef = useRef<SupplyPlanWizardHandle | null>(null);
  useEffect(() => {
    if (!simAnchor) return;
    /* Click-only dismissal (buyer 2026-07-19: "close when I
       specifically click on outside, not when my cursor is anywhere
       on another space").

       Listen in CAPTURE phase so we see the click at the target,
       BEFORE it reaches any onClick handlers that could re-render
       and shift the DOM (which was breaking chooserWrapRef.contains
       when the target was a button whose parent had just swapped).

       Grace window: ignore any click within 250 ms of mount so the
       click that OPENED the modal doesn't itself trigger dismissal.

       Portal safety: shadcn Select / Popover / DropdownMenu / Tooltip
       content mount into body-level portals — check multiple known
       Radix content wrapper attributes so any popup opened from
       within the modal is treated as part of the modal for
       dismiss-guard purposes. */
    const openedAt = performance.now();
    const onOutsideClick = (ev: MouseEvent) => {
      if (performance.now() - openedAt < 250) return;
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      /* Blanket guard: if ANY Radix popper is currently mounted
         anywhere in the document, skip dismissal. When the buyer
         opens the UOM Select (or the calendar popover, etc.) from
         inside the modal, that popup mounts a
         `[data-radix-popper-content-wrapper]` at body level. As long
         as it exists, we're mid-interaction with a control inside
         the modal and MUST NOT dismiss. Clicks that would legitimately
         close the modal happen only when no popper is open. */
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      /* Direct check: target inside our modal wrapper via data attr.
         `closest()` uses DOM walking, immune to React render timing. */
      if (target.closest("[data-supply-modal='true']")) return;
      const handled = supplyWizardHandleRef.current?.requestClose();
      if (!handled) setSimAnchor(null);
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, [simAnchor]);

  /* Outside-graph click → close pinned card. Buyer feedback 2026-07-14
     "click anywhere the card will be closed". Inside-graph closes are
     handled by React `onClick` handlers: dot buttons stopPropagation
     (togglePinned owns them), whole-plot layer's onClick closes on
     empty clicks, chartBoxRef's onClick catches anything that bubbles
     past those (safety net for when the whole-plot layer isn't
     mounted). This effect only listens for clicks OUTSIDE the chart
     box + outside the portalled pinned card. */
  const pinnedCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pinnedDay == null) return;
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (pinnedCardRef.current && pinnedCardRef.current.contains(target)) return;
      if (chartBoxRef.current && chartBoxRef.current.contains(target)) return;
      setPinnedDay(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pinnedDay]);
  /* Last day reported to `onHoverDay` — dedupes per-pixel mousemove. */
  const hoverDayRef = useRef<number | null>(null);
  /* The day under the cursor, for the overlay guide + hover detail card. */
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  /* Whether the pointer is directly over a dot (or an equivalent
     hit-target like the plan-hit / order-hit buttons). Gates the
     day-detail hover card so it stops popping when the buyer is only
     tracing the ATP curve or resting the pointer in an empty day
     column. Buyer feedback 2026-07-14: "cards blocking dots — show
     the card only when I'm on a dot." Guide + click-to-add pill are
     unaffected; they still respond to the raw `hoverDay`. */
  const [hoverOnDot, setHoverOnDot] = useState<boolean>(false);
  const hoverOnDotRef = useRef<boolean>(false);
  hoverOnDotRef.current = hoverOnDot;
  /* Which planned-PO triad (order diamond → dashed curve → arrival) is
     currently under the pointer. Setting this pops the whole triad — full
     opacity + heavier stroke + tinted diamond — so the buyer sees the entire
     affected line, not just a stray dot on the projection curve. */

  /* Hover-intent bridge. Moving the pointer from a plotted point onto its
     floating detail card briefly leaves the plot, which would normally clear
     the hover and unmount the card before its trash control could be clicked.
     So the hover CLOSE is deferred and cancelled the instant the pointer lands
     on the card (or returns to the plot) — letting the hover card itself be
     interactive: delete a simulation / vendor plot straight from hover, with
     no click-to-pin needed first. */
  const hoverCloseTimer = useRef<number | null>(null);
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current != null) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };
  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverCloseTimer.current = window.setTimeout(() => {
      hoverCloseTimer.current = null;
      hoverDayRef.current = null;
      setHoverDay(null);
      onHoverDay?.(null);
      /* Clear on-dot state in the same tick so the card doesn't
         linger after the buyer has left the plot for the 160ms
         intent-bridge window. */
      setHoverOnDot(false);
    }, 160);
  };
  useEffect(
    () => () => {
      if (hoverCloseTimer.current != null) clearTimeout(hoverCloseTimer.current);
    },
    [],
  );

  /* Plot geometry, captured from Recharts' scales each render (ScaleCapture).
     Kept in a ref (scales are new fns every render) + a version bump so the
     overlay re-lays-out only when the geometry actually changes. */
  const plotGeomRef = useRef<PlotGeom | null>(null);
  /* Signature of the captured plot box + scale DOMAINS. When it changes the
     overlay must re-render so it never paints with a stale scale — e.g. a
     30/60/90/custom window switch remaps the x domain without resizing the box,
     which the old offset-only check missed (connectors detached from dots). */
  const geomSigRef = useRef("");
  const [geomTick, setGeomTick] = useState(0);

  /* Need-by + Order-by lines are two draggable vertical anchors, linked by the
     lead time (order-by = need-by − lead). Both the full-height strip AND the top
     pill drag; a pill click (no drag) opens an inline calendar (portaled, so the
     plot's overflow-hidden can't clip it). `editLine` = which line's calendar is
     open; `editAnchor` = the pill rect at open time; `lineDragRef` gates the
     drag-move + the click-vs-drag decision (only ONE drag at a time). */
  const canEditNeedBy = !!onNeedByChange;
  const [editLine, setEditLine] = useState<"needby" | "orderby" | null>(null);
  const [editAnchor, setEditAnchor] = useState<{ cx: number; top: number } | null>(null);
  // A day-click in the calendar only PENDS a date; the explicit "Apply" click
  // commits it (moves the line). Seeded from the line's current day on open.
  const [pendingLineDate, setPendingLineDate] = useState<Date | null>(null);
  const lineDragRef = useRef(false);
  const linePopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!editLine) {
      setPendingLineDate(null);
      return;
    }
    const d = editLine === "needby" ? deadlineDay : orderByDay;
    setPendingLineDate(d != null ? dayToDateLocal(d) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLine]);
  useEffect(() => {
    if (!editLine) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (linePopRef.current?.contains(t)) return;
      if (t.closest?.("[data-deadline-pill]")) return;
      setEditLine(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [editLine]);

  const canSimulate = !!onSimulateAdd;
  const canPlotVendor = !!onPlotVendor && !!vendors && vendors.length > 0;

  /* The full marketplace backing the "Show all vendors" path; falls back to the
     qualified set. Built once so name-lookups resolve a plotted non-qualified
     vendor too. */
  const marketplace = allVendors && allVendors.length > 0 ? allVendors : (vendors ?? []);
  const vendorByName = useMemo(
    () => new Map(marketplace.map((v) => [v.vendorName, v] as const)),
    [marketplace],
  );

  /* Responsive sizing. We track viewport width AND height: width drives a fluid
     UI scale (small screens stay compact, 2K/4K scale up so nothing turns tiny),
     height drives the chart's own height where it isn't flex-filled. */
  const [viewportH, setViewportH] = useState(
    typeof window !== "undefined" ? window.innerHeight : 900,
  );
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );
  useEffect(() => {
    const onResize = () => {
      setViewportH(window.innerHeight);
      setViewportW(window.innerWidth);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  /* Fluid UI scale, driven by viewport width. It dips slightly (~0.96) at 1080p /
     laptops to cut clutter, and is CAPPED at 1.0 on larger screens — NO up-scaling
     on 2K/4K (the buyer found scaled-up fonts too large). Positions stay in raw
     chart pixels — ONLY sizes scale. HTML text reads it via the inherited `--gs`
     CSS var; SVG and layout dimensions use the numeric helpers. Tuning knobs: the
     2000 divisor + the 0.92/1.0 clamps (raise the upper clamp to re-enable growth). */
  const uiScale = Math.min(1, Math.max(0.92, viewportW / 2000));
  const gs = (px: number) => Math.round(px * uiScale); // integer px (radii, dims)
  /* Font scale — cranked ~25% smaller than `uiScale` alone so labels read
     compact on 2K/4K (user feedback: labels felt oversized even after the
     first 15% pass). Dim scale `gs` stays untouched to keep dot / marker
     geometry crisp. */
  const gf = (px: number) => Math.round(px * uiScale * 0.75 * 10) / 10;
  const chartH = Math.round(Math.min(860, Math.max(320, viewportH * 0.48)));

  /* Effective curve — swaps to `baselineCurve` (real events only, no
     proposed POs) when the buyer hides the "Planned purchase orders"
     legend chip. Buyer feedback 2026-07-20: "when I turn planned
     purchase off, the line needs to update accordingly." The parent
     already computes both curves; we just pick which one to render
     based on the chip toggle. Simulations, drafts and real POs stay
     reflected in either curve — only proposed POs are the delta. */
  const effectiveCurve = useMemo(() => {
    if (hiddenKinds.has("proposed") && baselineCurve && baselineCurve.length > 0) {
      return baselineCurve;
    }
    return curve;
  }, [curve, baselineCurve, hiddenKinds]);

  /* Line data + lookups. */
  const data = effectiveCurve.map((p) => ({ day: p.day, atp: p.atp }));
  const atpByDay = useMemo(() => new Map(effectiveCurve.map((p) => [p.day, p.atp])), [effectiveCurve]);
  const dateByDay = useMemo(() => new Map(effectiveCurve.map((p) => [p.day, p.date])), [effectiveCurve]);

  /* Visible window left edge — clamped into [0, horizonDays-1]. */
  const winStart = Math.max(0, Math.min(startDay, Math.max(0, horizonDays - 1)));

  /* The first day the curve drops below min IS marked by the need-by line, and
     each guardrail is a dotted horizontal line — so the old yellow "you're
     dropping below …" sentence call-outs were removed as redundant clutter. */

  /* Y domain from the curve + thresholds (stable — supply only lifts it). */
  const atps = effectiveCurve.map((p) => p.atp);
  const lo = Math.min(0, item.minLevel, ...(atps.length ? atps : [0]));
  const hi = Math.max(item.maxLevel, ...(atps.length ? atps : [item.maxLevel]));
  const pad = Math.max(5, Math.ceil((hi - lo) * 0.12));
  const yDomain: [number, number] = [lo - pad, hi + pad];

  /* Y-axis ticks — buyer 2026-07-21: put min/max thresholds first, then
     the highest/lowest data-point values. Ticks are collapsed so two
     nearly-identical numbers don't stack on top of each other. */
  const dataLo = atps.length ? Math.min(...atps) : lo;
  const dataHi = atps.length ? Math.max(...atps) : hi;
  const yAxisTicks = useMemo(() => {
    /* Zero joins min/max as a permanent threshold anchor (buyer
       2026-07-22 — added a dashed reference line at 0). Only include
       it when the y-domain actually crosses zero so we don't force
       the axis to extend for a threshold that isn't in view. */
    const raw = [item.minLevel, item.maxLevel, Math.floor(dataLo), Math.ceil(dataHi)];
    if (lo <= 0 && hi >= 0) raw.push(0);
    const uniq = Array.from(new Set(raw)).sort((a, b) => a - b);
    const gap = Math.max(1, (hi - lo) * 0.06);
    const out: number[] = [];
    for (const t of uniq) {
      /* Never drop the zero anchor even if it's within `gap` of another
         tick — the buyer relies on it. */
      if (out.length === 0 || t === 0 || Math.abs(t - out[out.length - 1]) >= gap) out.push(t);
    }
    return out;
  }, [item.minLevel, item.maxLevel, dataLo, dataHi, hi, lo]);
  /* Custom tick renderer — min/max/zero thresholds render bolder +
     slate-800; data-point ticks render lighter. Threshold rows get a
     "min" / "max" / "zero" prefix so the axis reads "min 26" not just
     "26". */
  const renderYTick = (props: {
    x?: number;
    y?: number;
    payload?: { value?: number };
  }) => {
    const value = props.payload?.value;
    if (typeof value !== "number") return <g />;
    const isMax = value === item.maxLevel;
    const isMin = value === item.minLevel;
    const isZero = value === 0;
    const isThreshold = isMax || isMin || isZero;
    return (
      <g transform={`translate(${(props.x ?? 0) - 2},${props.y ?? 0})`}>
        <text
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={gf(10)}
          fontWeight={isThreshold ? 700 : 400}
          fill={isThreshold ? "#0F172A" : "#94a3b8"}
        >
          {isMax ? `max ${value}` : isMin ? `min ${value}` : isZero ? "zero 0" : value}
        </text>
      </g>
    );
  };

  /* Events → per-day groups, honouring the colour-key + Simulated toggles and
     the visible window. One group per day = the unit both views render. */
  const shownEvents = useMemo(
    () =>
      events.filter((e) => {
        if (e.excluded || e.signal) return false;
        return e.mock ? showSim : !hiddenKinds.has(dotTypeOf(e));
      }),
    [events, showSim, hiddenKinds],
  );
  const hasSim = useMemo(() => events.some((e) => !e.excluded && !e.signal && e.mock), [events]);
  /* How many entries the buyer has plotted — split by category so the Clear menu
     can offer purchase orders / simulations / both independently. Proposed
     events are vendor POs; mock events are simulated demand/supply what-ifs. */
  const proposedCount = useMemo(
    () => events.filter((e) => e.kind === "proposed").length,
    [events],
  );
  const simCount = useMemo(() => events.filter((e) => !!e.mock).length, [events]);
  const addedCount = proposedCount + simCount;
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  const eventsByDay = useMemo(() => {
    const m = new Map<number, GapGraphEvent[]>();
    for (const e of shownEvents) {
      if (e.day < winStart || e.day > horizonDays) continue;
      const a = m.get(e.day);
      if (a) a.push(e);
      else m.set(e.day, [e]);
    }
    return m;
  }, [shownEvents, winStart, horizonDays]);

  /* Drag-preview state — declared here (before clusterData) because
     the cluster memo filters the dragged event out of its origin day
     while the drag is in flight. Keeping it above the memo avoids a
     temporal dead-zone error. */
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    offsetX: number;
    previewDay: number | null;
  } | null>(null);

  /* Dots view — one cluster row per event-day (fixed-footprint marker). */
  const MAX_SEG = 4;
  const clusterData = useMemo(() => {
    const rows: Array<{
      day: number;
      atp: number;
      segs: Array<{ color: string; hollow: boolean }>;
      count: number;
      userAdded: boolean;
      justAdded: boolean;
      addedTone: string;
      /** Set only when count === 1 AND that single event is user-added —
          keyed to the event so the dot's own drag handler can commit to
          `onMoveEvent(id, newDay)`. Real supply/demand rows never carry an
          id here (they're fixed by their source docs). Auto events are
          NOT draggable (they'd re-compute on the next render). */
      draggableId?: string;
      /** True when the lone user-added event on this day is an auto
          recommendation (not a manual sim). Drives the distinct hollow
          dashed-ring visual so the buyer can tell auto from manual. */
      autoRecommendation?: boolean;
    }> = [];
    for (const [day, evsAll] of eventsByDay) {
      /* During drag, filter the DRAGGED event out of its origin
         cluster's render so the OTHER events on that day (real
         demand + incoming POs, etc.) still show. Previously the
         entire cluster was hidden via clusterShape's early return,
         which made PR/SO/incoming PO markers "disappear" alongside
         the drag preview — buyer feedback 2026-07-15: "the demand
         that is already on Jul 20 the dots is also removed now".
         `draggableId` is still derived from the ORIGINAL evsAll
         so the plan-hit button keeps its dragId association even
         when the filtered cluster is empty or userAdded=false. */
      const evs =
        dragPreview
          ? evsAll.filter((e) => e.id !== dragPreview.id)
          : evsAll;
      const manualUserEventsAll = evsAll.filter(
        (e) => isUserAddedEvent(e) && !e.autoRecommendation,
      );
      const draggableId =
        manualUserEventsAll.length === 1 ? manualUserEventsAll[0].id : undefined;
      // Nothing to render for this day if the drag emptied it out.
      if (evs.length === 0 && !draggableId) continue;
      const added = evs.find(isUserAddedEvent);
      rows.push({
        day,
        atp: atpByDay.get(day) ?? 0,
        segs: evs.slice(0, MAX_SEG).map((e) => ({ color: eventTone(e), hollow: !!e.mock || !!e.draft || !!e.draftPO })),
        count: evs.length,
        userAdded: !!added,
        justAdded: evs.some((e) => justAddedIds.has(e.id)),
        addedTone: added ? eventTone(added) : C_SUPPLY,
        draggableId,
        autoRecommendation: evs.length === 1 && !!added?.autoRecommendation,
      });
    }
    return rows;
  }, [eventsByDay, atpByDay, justAddedIds, dragPreview]);

  /* Days that carry a user-added point — the click targets that open a pinned
     detail card (vendor plots AND simulated supply/demand). */
  const userAddedDays = useMemo(() => {
    const out: number[] = [];
    for (const [day, evs] of eventsByDay) if (evs.some(isUserAddedEvent)) out.push(day);
    return out;
  }, [eventsByDay]);

  /* Axis cadence coarsens as the window widens (daily → weekly → monthly) so a
     long horizon stays legible instead of cramming a tick per day; month starts
     and the window edges are always kept as anchors. The full date range is
     preserved — only the label density changes. */
  const winSpan = horizonDays - winStart;
  const tickMode: "day" | "week" | "month" = winSpan <= 45 ? "day" : winSpan <= 150 ? "week" : "month";
  const dayOfMonth = (d: number) => {
    const iso = dateByDay.get(d);
    return iso ? Number(iso.slice(8, 10)) : 0;
  };
  const xTicks: number[] = [];
  for (let d = winStart; d <= horizonDays; d++) {
    const isAnchor = dayOfMonth(d) === 1 || d === horizonDays || d === winStart;
    const onCadence =
      tickMode === "day"
        ? (d - winStart) % (winSpan <= 30 ? 1 : 2) === 0
        : tickMode === "week"
          ? (d - winStart) % 7 === 0
          : false;
    if (onCadence || isAnchor) xTicks.push(d);
  }
  const xTickFmt = (d: number) => {
    const iso = dateByDay.get(d);
    if (!iso) return `${d}`;
    const mon = Number(iso.slice(5, 7));
    const dom = Number(iso.slice(8, 10));
    /* Wide windows: carry the month on every tick so the coarse axis reads. */
    if (tickMode !== "day" || d === 0 || dom === 1) return `${MONTHS[mon - 1]} ${dom}`;
    return `${dom}`;
  };

  /* Fixed-footprint cluster marker for the dots view. Never grows with count:
     1 event → a dot; a few → a colour-segmented pill; many → a "×N" badge.
     A user-ADDED day (vendor plot or simulated supply/demand) wears a steady
     ring in its own tone so it reads as added + interactive; the entry the
     buyer just created also pulses so it's instantly findable. */
  /* Drag a user-added event dot along the X-axis to reschedule it. Only
     lone (count === 1) user-added dots are draggable — clusters would be
     ambiguous, and real SO/PR/Receiving dots are locked to their source doc.
     Pointer-move commits on the fly through `onMoveEvent`, matching the
     anchor-line pattern above. A press < 3px counts as a click (falls
     through to the pin-popover), anything more is a drag.

     Kick-off accepts any React pointer event — the full-plot HTML overlay
     that sits ABOVE the Recharts SVG (z-20) hit-tests to detect a dot press
     and delegates HERE, since the overlay would otherwise swallow the
     scatter's own onPointerDown. */
  const dotDragRef = useRef(false);
  /* Swallow-the-next-click flag: set the moment we start a drag on the
     overlay so its onClick create-popover doesn't fire after pointerup. */
  const clickSwallowRef = useRef(false);
  /* Pointer-is-pressed flag — set on drag pointerdown, cleared on pointerup.
     While true, the overlay's onMouseMove skips setHoverDay so the floating
     day-card doesn't chase the drag pointer + collide with the dragging
     event's own hover state. */
  const dragActiveRef = useRef(false);
  /* Pointer-capture drag state — the button's setPointerCapture keeps
     pointermove/pointerup events firing on the button itself, so we track
     the drag's starting clientX + the event id being moved via refs so the
     inline handlers can read them across event ticks. */
  const dragStartXRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  /* Day being armed for drag (pointer is DOWN on its hit-target). Distinct
     from an actual drag (which requires a small pixel-motion threshold).
     Drives immediate visual feedback so the buyer sees "I've grabbed the
     dot" before they move — solves the "cursor turns to grab but nothing
     happens on press" perception gap. Cleared on pointerup/cancel. */
  const [armedDay, setArmedDay] = useState<number | null>(null);
  /* dragPreview moved above clusterData earlier this session — the memo
     reads it to filter the dragged event out of its origin cluster
     mid-drag. Declaration relocated 2026-07-15 to escape the temporal
     dead zone that fired "Cannot access 'dragPreview' before
     initialization" from the useMemo. */
  /* No-op setter — the drag pipeline's inline `setDebugStatus(...)`
     calls compile against this and produce no visible output.
     Diagnostic pill removed once the drag pipeline settled. */
  const setDebugStatus = (_: string): void => {
    void _;
  };
  /* Cursor over the plot-interaction overlay. `grab` when the pointer is
     directly on a draggable user-added dot; `copy` otherwise (empty-space
     click-to-add affordance). State-driven so React re-applies it on every
     render — mutating `style.cursor` directly gets clobbered by the inline
     `style={{cursor:"copy"}}` prop the overlay re-emits each render. */
  const [plotCursor, setPlotCursor] = useState<"copy" | "grab">("copy");
  const startDotDrag = (
    e: { clientX: number; preventDefault: () => void; stopPropagation: () => void },
    eventId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dotDragRef.current = false;
    dragActiveRef.current = true;
    /* Immediately close BOTH the pinned popover AND the floating hover-day
       card so they don't sit over the drag path. `hoverDayRef` is nulled
       too so the ref-guarded onMouseMove in the overlay doesn't re-open
       the card at the same day the moment we set it to null via state. */
    setPinnedDay(null);
    hoverDayRef.current = null;
    setHoverDay(null);
    const startX = e.clientX;
    const onMove = (ev: PointerEvent) => {
      if (!dotDragRef.current && Math.abs(ev.clientX - startX) > 3) {
        dotDragRef.current = true;
      }
      if (!dotDragRef.current) return;
      const d = dayFromClientX(ev.clientX);
      if (d != null) onMoveEvent(eventId, d);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      dragActiveRef.current = false;
      // Reset shortly so a click that follows this pointerup still fires.
      setTimeout(() => { dotDragRef.current = false; }, 0);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const clusterShape =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => {
      if (p?.cx == null || p?.cy == null) return <g />;
      const cx = p.cx as number;
      const cy = p.cy as number;
      const segs: Array<{ color: string; hollow: boolean }> = p.payload?.segs ?? [];
      const count: number = p.payload?.count ?? segs.length;
      const userAdded: boolean = !!p.payload?.userAdded;
      const justAdded: boolean = !!p.payload?.justAdded;
      const tone: string = p.payload?.addedTone ?? C_SUPPLY;
      const draggableId: string | undefined = p.payload?.draggableId;
      /* During drag, the dragged event is filtered out of `evs` in
         `clusterData` (see the useMemo above). If that filter leaves
         a cluster with 0 events but the button still exists for the
         drag anchor, count=0 — render nothing here. Other events on
         the same day render normally with their reduced count. */
      if (count === 0) return <g />;

      /* Ring (user-added only): a steady tone ring, plus an expanding glow on
         the just-created entry so the buyer spots it without hunting. */
      const ring = userAdded ? (
        <>
          {justAdded && (
            <circle cx={cx} cy={cy} r={gs(11)} fill={tone} opacity={0.22}>
              <animate attributeName="r" values="10;18;10" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite" />
            </circle>
          )}
          <circle cx={cx} cy={cy} r={gs(11)} fill="none" stroke={tone} strokeWidth={justAdded ? 2.2 : 1.6} opacity={0.9} />
        </>
      ) : null;

      if (count === 1) {
        const s = segs[0] ?? { color: C_LINE, hollow: false };
        const autoRecommendation: boolean = !!p.payload?.autoRecommendation;
        /* A lone user-added point — the prominent ringed dot the buyer must
           never lose track of (bigger, white-haloed, inside the tone ring).
           Draggable along the X-axis when `draggableId` is present: the dot
           becomes a grab-handle that commits new days on the fly via
           `onMoveEvent`, so buyers can reschedule a sim/planned event without
           deleting-and-recreating.
           Auto events get a distinct hollow dashed-ring treatment so they
           read as "system-suggested" rather than "you added this" — same
           tone, no drag, no solid fill. */
        if (userAdded) {
          if (autoRecommendation) {
            return (
              <g style={{ cursor: "default" }}>
                <circle cx={cx} cy={cy} r={gs(11)} fill="none" stroke={tone} strokeWidth={1.4} strokeDasharray="3 2" opacity={0.85} />
                <circle cx={cx} cy={cy} r={gs(6)} fill="#FFFFFF" stroke={tone} strokeWidth={2} strokeDasharray="2 1.6" />
              </g>
            );
          }
          /* IMPORTANT: the plan-hit HTML button above the SVG (z-32)
             owns the drag pipeline (drag-preview + snap-to-closest-
             other-event + merge). The SVG scatter dot used to carry
             its own `startDotDrag` handler that updated the store
             day-by-day on every pointermove — an ORPHAN of the old
             drag design, but still catchable if the button was ever
             bypassed. Removed 2026-07-15 (buyer feedback: "you are
             moving the dot, not the supply plotting logic") so
             every drag goes through the new pipeline. Cursor still
             flips to `grab` on hover so the affordance reads. */
          const dragProps: {
            style: React.CSSProperties;
          } = {
            style: {
              cursor: draggableId ? "grab" : "pointer",
              touchAction: draggableId ? "none" : undefined,
            },
          };
          /* Buyer feedback 2026-07-15: a lone plotted supply used to
             render as a solid circle-in-ring, but a supply that lands
             on a day WITH demand renders as stacked colored bars in a
             ring. Two visual treatments felt inconsistent — dragging a
             supply to an empty day made it "look different" from a
             merged plot. Now every user-added marker renders as a
             single colored BAR inside the ring, so the lone case
             visually matches the multi-event stacked case (just with
             one bar instead of many). */
          const W = gs(11);
          const H = gs(7);
          return (
            <g {...dragProps}>
              {ring}
              <rect
                x={cx - W / 2 - 1}
                y={cy - H / 2 - 1}
                width={W + 2}
                height={H + 2}
                rx={3}
                fill="#FFFFFF"
              />
              <rect
                x={cx - W / 2}
                y={cy - H / 2}
                width={W}
                height={H}
                rx={1.6}
                fill={s.color}
              />
            </g>
          );
        }
        return s.hollow ? (
          <circle cx={cx} cy={cy} r={gs(6.5)} fill="#FFFFFF" stroke={s.color} strokeWidth={2.4} strokeDasharray="3 2" />
        ) : (
          <circle cx={cx} cy={cy} r={gs(6)} fill={s.color} stroke="#FFFFFF" strokeWidth={1.8} />
        );
      }

      if (count <= MAX_SEG) {
        /* Buyer feedback 2026-07-15: merged clusters (a proposed PO
           landing on a demand day) rendered as an ambiguous small
           blob — from a screenshot it read like a lone solid dot,
           not a merger. Bumped bar width 9 → 11 and segment height
           5 → 7 so the stacked bars are visually distinct against
           the ring. Total footprint ≈ 11 × 14 for a 2-event stack. */
        const W = gs(11);
        const segH = gs(7);
        const totalH = segs.length * segH;
        const top = cy - totalH / 2;
        return (
          <g>
            {ring}
            <rect x={cx - W / 2 - 1} y={top - 1} width={W + 2} height={totalH + 2} rx={3} fill="#FFFFFF" />
            {segs.map((s, i) => (
              <rect
                key={i}
                x={cx - W / 2}
                y={top + i * segH}
                width={W}
                height={segH - 0.8}
                rx={1.6}
                fill={s.color}
                opacity={s.hollow ? 0.5 : 1}
              />
            ))}
          </g>
        );
      }

      return (
        <g>
          {ring}
          <circle cx={cx} cy={cy} r={gs(8.5)} fill="#475569" stroke="#FFFFFF" strokeWidth={1.6} />
          <text x={cx} y={cy + 3} textAnchor="middle" fontSize={gf(9)} fontWeight={700} fill="#FFFFFF">
            {count}
          </text>
        </g>
      );
    };

  /* Cards view — a lane-packed top rail of compact chips (date · dot · count),
     each with a leader line down to its curve point. Click a chip for full
     detail + delete (the pinned popover). ALWAYS chips — the old always-expanded
     day-cards were too cluttered, so there is no card↔chip switch anymore. */
  const cardLayout = useMemo(() => {
    const geom = plotGeomRef.current;
    if (!geom || eventDisplay !== "cards") return null;
    const days = Array.from(eventsByDay.keys()).sort((a, b) => a - b);
    if (!days.length) return { mode: "chip" as const, items: [] };

    const base = days.map((day) => {
      const evs = eventsByDay.get(day)!;
      const cx = geom.xScale(day);
      const cy = geom.yScale(atpByDay.get(day) ?? 0);
      return { day, evs, cx, cy };
    });

    const layoutFor = (cardW: number, fixedH: number | null) => {
      const items = base.map((b) => ({
        ...b,
        h: fixedH ?? Math.round(estimateCardHeight(b.evs, vendorByName) * uiScale),
        x: Math.max(geom.left, Math.min(geom.left + geom.width - cardW, b.cx - cardW / 2)),
        lane: 0,
        y: 0,
      }));
      const { lanes, laneCount } = packLanes(items.map((i) => i.x), cardW, gs(LANE_GAP));
      items.forEach((it, i) => (it.lane = lanes[i]));
      // Per-lane band heights stacked from the plot top → no vertical overlap.
      const laneMaxH: number[] = new Array(laneCount).fill(0);
      items.forEach((it) => (laneMaxH[it.lane] = Math.max(laneMaxH[it.lane], it.h)));
      const bandTop: number[] = [];
      // Drop the rail into the empty band BELOW the Max line (the Max line sits
      // at the plot top, so hugging the top covered it + the "Need by" pill).
      // Whichever is lower wins: a gs(68) floor (clears the pill on small
      // screens) or 20.3% of plot height (the tall 2K/4K plots have a big empty
      // band under Max, so use it). Tuning knob: the 0.203 fraction.
      let acc = geom.top + Math.max(gs(68), Math.round(geom.height * 0.203));
      for (let L = 0; L < laneCount; L++) {
        bandTop[L] = acc;
        acc += laneMaxH[L] + gs(LANE_VGAP);
      }
      items.forEach((it) => (it.y = bandTop[it.lane]));
      return { items, totalH: acc - geom.top };
    };

    // Always the compact chip rail (no full always-expanded day-cards).
    return { mode: "chip" as const, items: layoutFor(gs(CHIP_W), gs(CHIP_H)).items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomTick, eventsByDay, atpByDay, eventDisplay, vendorByName, winStart, horizonDays, uiScale]);

  /* Open the create popover at a day + pixel anchor (chart click or card click).
     Adding elsewhere closes any pinned planned-point card. */
  const openCreateAt = (day: number, x: number, y: number) => {
    setHoverDay(null);
    setPinnedDay(null);
    setSimAnchor({ x, y, day });
  };

  /* Auto-open the chooser at the day of an edit request from the
     host (buyer feedback 2026-07-20: Edit-in-place). We compute the
     x/y from the current plot geometry so the chooser lands on/near
     the event's plotted dot. Runs only when the request first
     arrives (guarded by an id ref) so subsequent re-renders don't
     reset simAnchor while the buyer is interacting. */
  const lastEditRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingSupplyRequest) {
      lastEditRequestIdRef.current = null;
      return;
    }
    if (lastEditRequestIdRef.current === editingSupplyRequest.id) return;
    lastEditRequestIdRef.current = editingSupplyRequest.id;
    const g = plotGeomRef.current;
    const rect = chartBoxRef.current?.getBoundingClientRect();
    if (!g || !rect) return;
    const day = editingSupplyRequest.arrivalDay;
    const cx = g.xScale(day);
    const cy = g.yScale(0);
    openCreateAt(day, cx, cy);
  }, [editingSupplyRequest]);

  /* Map a viewport x (a real pointer event) to a day offset, using the captured
     scale. This drives the whole-plot interaction layer so hover + click land on
     ANY day — independent of Recharts' active-point detection, which is flaky in
     empty regions when a Scatter series is present (only firing reliably on
     event dots). Returns null until the geometry is captured. */
  const dayFromClientX = (clientX: number): number | null => {
    const g = plotGeomRef.current;
    const rect = chartBoxRef.current?.getBoundingClientRect();
    if (!g || !rect) return null;
    const px = clientX - rect.left; // pixel in the SVG's own coordinate space
    const sc = g.xScale as unknown as { invert?: (v: number) => number };
    const raw =
      typeof sc.invert === "function"
        ? sc.invert(px)
        : winStart + ((px - g.left) / Math.max(1, g.width)) * (horizonDays - winStart);
    return Math.max(winStart, Math.min(horizonDays, Math.round(raw)));
  };

  /* Fractional-day cursor position — used by the drag-preview so the
     preview dot can sit on the curve between two integer days (rather
     than snapping to the nearest integer day's ATP, which visually
     yanks the dot off the line when the curve is steep between days). */
  const fractionalDayFromClientX = (clientX: number): number | null => {
    const g = plotGeomRef.current;
    const rect = chartBoxRef.current?.getBoundingClientRect();
    if (!g || !rect) return null;
    const px = clientX - rect.left;
    const sc = g.xScale as unknown as { invert?: (v: number) => number };
    const raw =
      typeof sc.invert === "function"
        ? sc.invert(px)
        : winStart + ((px - g.left) / Math.max(1, g.width)) * (horizonDays - winStart);
    return Math.max(winStart, Math.min(horizonDays, raw));
  };

  const geom = plotGeomRef.current;
  const boxH = chartBoxRef.current?.clientHeight ?? chartH;
  /* Req #6 — EFFECTIVE hover day for the day-detail card. The graph's own
     pointer hover (`hoverDay`) always wins; only when the pointer isn't over a
     day do we fall back to the parent-supplied `externalHoverDay` (e.g. a
     Transaction-Table row the user is hovering). This is read-ONLY here — the
     write-back paths (setHoverDay / hoverDayRef / onHoverDay) still use the raw
     internal `hoverDay`, so an external day never re-emits onHoverDay and can't
     loop. When `externalHoverDay` is null/undefined this equals `hoverDay`, so
     existing callers see zero behavior change. */
  const effHoverDay = hoverDay ?? externalHoverDay ?? null;
  /* Hover affordance + dots-view detail card geometry (recomputed each render;
     geomTick re-renders after the scales settle). */
  const showHover = effHoverDay != null && geom != null && simAnchor == null;
  const hoverCx = showHover ? geom!.xScale(effHoverDay!) : 0;
  const hoverAtp = effHoverDay != null ? atpByDay.get(effHoverDay) : undefined;
  const hoverCy = showHover && hoverAtp != null ? geom!.yScale(hoverAtp) : geom ? geom.top : 0;
  /* During drag, filter the dragged event out of the hover source
     too — otherwise the origin day's hover card keeps listing the
     PO the buyer is actively moving away. Buyer feedback 2026-07-15
     ("you are moving the dot, you are not moving the logic"): the
     visual cluster already respects this filter via `clusterData`;
     the hover card needs to match so the two agree while a drag
     is in flight. Once the drop commits and dragPreview clears, the
     filter goes away and the card reflects the new state. */
  const hoverEvents = effHoverDay != null
    ? (eventsByDay.get(effHoverDay) ?? []).filter(
        (e) => !dragPreview || e.id !== dragPreview.id,
      )
    : [];
  const hoverDateLabel =
    effHoverDay != null ? fmtRealDate(dateByDay.get(effHoverDay)) || (effHoverDay === 0 ? "Today" : `+${effHoverDay}d`) : "";
  const dayBandW = geom ? Math.min(28, geom.width / Math.max(1, horizonDays - winStart)) : 0;

  /* ── Need-by / Order-by anchor lines ──
     Two INDEPENDENT draggable anchors: need-by commits via onNeedByChange,
     order-by via onOrderByChange, each to its OWN override — moving one never
     moves the other (`orderByDay` is a prop, seeded in the parent from the
     baseline deadline, not the live need-by). The lead time only feeds the
     calendar hint copy. */
  const canEditOrderBy = !!onOrderByChange;
  const canEditLine = (key: "needby" | "orderby") =>
    key === "needby" ? canEditNeedBy : canEditOrderBy;
  /** Commit a new day for a line → its OWN override (independent). */
  const commitLineDay = (key: "needby" | "orderby", day: number) => {
    const d = Math.max(0, Math.min(horizonDays, day));
    if (key === "needby") onNeedByChange?.(d);
    else onOrderByChange?.(d);
  };
  /* Pointer-drag for a line, shared by its strip and its pill. On the pill, a
     press with no movement (< 3px) is a click → open that line's calendar;
     anything past the threshold is a drag. Tracking is on `document` for the
     gesture so it never drops when the pointer leaves the thin handle. */
  const startLineDrag = (
    e: React.PointerEvent,
    key: "needby" | "orderby",
    fromPill: boolean,
  ) => {
    if (!canEditLine(key)) return;
    e.preventDefault();
    e.stopPropagation();
    lineDragRef.current = false;
    const startX = e.clientX;
    const pillEl = fromPill ? (e.currentTarget as HTMLElement) : null;
    const onMove = (ev: PointerEvent) => {
      if (!lineDragRef.current && Math.abs(ev.clientX - startX) > 3) {
        lineDragRef.current = true;
        setEditLine(null); // a real drag began → close any open calendar
      }
      if (!lineDragRef.current) return;
      const d = dayFromClientX(ev.clientX);
      if (d != null) commitLineDay(key, d);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (fromPill && !lineDragRef.current && pillEl) {
        const r = pillEl.getBoundingClientRect();
        setEditAnchor({ cx: r.left + r.width / 2, top: r.bottom + 6 });
        setEditLine((prev) => (prev === key ? null : key));
      }
      lineDragRef.current = false;
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };
  /** Strip + draggable pill for one anchor line (need-by or order-by). */
  const renderDeadlineLine = (cfg: {
    key: "needby" | "orderby";
    day: number | null;
    color: string;
    label: string;
    dateText: string;
  }) => {
    const g = geom;
    if (!g || cfg.day == null || cfg.day < winStart || cfg.day > horizonDays) return null;
    const editable = canEditLine(cfg.key);
    const cx = g.xScale(cfg.day);
    const pill = (
      <div
        className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
        style={{ left: cx, top: Math.max(0, g.top - 8), zIndex: 31 }}
      >
        <button
          type="button"
          data-deadline-pill={cfg.key}
          disabled={!editable}
          onPointerDown={(e) => startLineDrag(e, cfg.key, true)}
          title={editable ? "Drag to move, or click to pick a date" : undefined}
          className="pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold text-white shadow-sm"
          style={{
            backgroundColor: cfg.color,
            fontSize: gf(10),
            cursor: editable ? "grab" : "default",
            touchAction: "none",
          }}
        >
          <CalendarDays className="size-2.5" />
          {cfg.label} {cfg.dateText}
        </button>
      </div>
    );
    if (!editable) return <>{pill}</>;
    return (
      <>
        {/* Full-height drag strip over the line (zIndex keeps the pointer-down
            from being stolen by the click-to-add layer / planned-point targets). */}
        <div
          role="slider"
          aria-label={`${cfg.label} date`}
          aria-valuenow={cfg.day}
          aria-valuemin={winStart}
          aria-valuemax={horizonDays}
          tabIndex={0}
          title={`Drag to move the ${cfg.label.toLowerCase()} date`}
          onPointerDown={(e) => startLineDrag(e, cfg.key, false)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            commitLineDay(cfg.key, cfg.day! + (e.key === "ArrowRight" ? 1 : -1));
          }}
          className="group pointer-events-auto absolute"
          style={{
            left: cx - 8,
            top: g.top,
            width: 16,
            height: g.height,
            cursor: "ew-resize",
            touchAction: "none",
            zIndex: 30,
          }}
        >
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 shadow ring-2 ring-white transition-opacity group-hover:opacity-100"
            style={{ width: 10, height: 30, backgroundColor: cfg.color }}
          />
        </div>
        {pill}
      </>
    );
  };
  /* Show the floating hover card in dots view always (incl. empty days), and in
     cards view only for condensed chips (full cards already show detail).
     Req #6 — compare the EFFECTIVE day to pinnedDay so a parent-driven external
     day that matches the pinned day still suppresses the duplicate hover card. */
  /* Card render rules (buyer feedback 2026-07-14, refined):
       · Hover a dot → card appears transiently (`hoverOnDot` gate).
       · Click a dot → card stays open (`pinnedDay`) even after the
         pointer leaves.
       · Click anywhere else on the graph → pinned card closes.
     `showHoverCard` here drives the transient case only. When a day
     is already pinned, we suppress the hover card on that day (the
     pinned card is already showing the same content). */
  const showHoverCard =
    showHover
    && hoverOnDot
    && hoverEvents.length > 0
    && effHoverDay !== pinnedDay
    && (eventDisplay === "dots" || cardLayout?.mode === "chip");

  return (
    <div
      className={`relative w-full ${fillHeight ? "flex h-full flex-col" : ""}`}
      /* `--gs` is the multiplier for every calc(Npx * var(--gs, 1)) inside
         this tree — HTML overlays (day-card, chips, vendor rows). Cranked
         ~25% smaller than the raw `uiScale` so labels read compact on
         2K/4K, matching the reduction we applied to `gf` above. */
      style={{ "--gs": uiScale * 0.75 } as React.CSSProperties}
    >
      {/* ── Colour key (toggles) + event display switch ── */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {DOT_TYPES.filter((t) => {
            /* Buyer feedback 2026-07-14: "Planned purchase orders"
               shouldn't sit in the legend when nothing is plotted —
               it advertises a lane the graph doesn't have. Show the
               chip only when at least one non-excluded proposed
               event exists on the current view. Other chip types
               (SO / Purchase orders / Draft) stay visible so
               the legend still reads as a full key when the graph
               is idle. */
            /* Purchase Requests parked from procurement (2026-07-20
               flag). Hide the PR chip until the flag flips back on. */
            if (t === "pr" && !SHOW_PURCHASE_REQUESTS_IN_PLANNER) return false;
            if (t !== "proposed") return true;
            return events.some(
              (e) => !e.excluded && !e.signal && dotTypeOf(e) === "proposed",
            );
          }).map((t) => {
            /* For the DRAFT chip, when the workspace supplies the shared
               `showDrafts` state (controlled mode), the chip reads/writes
               that instead of the local `hiddenKinds` set. This is what
               keeps the graph chip and the Transaction Table's "Draft
               purchase orders" pill in lockstep — turning it off in
               either place hides drafts from graph + table + projection.
               When the controlled props aren't provided, fall back to
               the legacy local-only hide behaviour so other embedders
               (Classic gap graph, dashboards) still work. */
            const draftControlled =
              t === "draft" && onShowDraftsChange !== undefined && showDraftsProp !== undefined;
            const on = draftControlled ? !!showDraftsProp : !hiddenKinds.has(t);
            const handleClick = draftControlled
              ? () => onShowDraftsChange!(!showDraftsProp)
              : () => toggleKind(t);
            return (
              <button
                key={t}
                type="button"
                onClick={handleClick}
                title={on ? `Hide ${DOT_TONE[t].label}` : `Show ${DOT_TONE[t].label}`}
                /* Whole header row (legend chips, Clear, Dots/Cards) sits
                   at a flat 10px per buyer 2026-07-19. No responsive
                   bump — the row reads as one uniform control tier. */
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors hover:shadow-sm"
                style={{
                  borderColor: on ? `${DOT_TONE[t].fill}55` : "#E2E8F0",
                  backgroundColor: on ? `${DOT_TONE[t].fill}12` : "#FFFFFF",
                  color: on ? "#334155" : "#94A3B8",
                  textDecoration: on ? "none" : "line-through",
                }}
                onMouseEnter={(e) => {
                  // Strengthen the tint + border on hover so the chip reads as a
                  // clickable toggle (it shows/hides this series on the graph).
                  e.currentTarget.style.backgroundColor = on ? `${DOT_TONE[t].fill}24` : "#F8FAFC";
                  e.currentTarget.style.borderColor = on ? `${DOT_TONE[t].fill}99` : "#CBD5E1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = on ? `${DOT_TONE[t].fill}12` : "#FFFFFF";
                  e.currentTarget.style.borderColor = on ? `${DOT_TONE[t].fill}55` : "#E2E8F0";
                }}
              >
                <span
                  /* "Planned" (proposed) uses a smaller inner disc so
                     the concentric ring lands INSIDE an ~8px footprint,
                     matching every other chip's swatch. Previously the
                     3px outer ring pushed it to ~14px — buyer 2026-07-19
                     "reduce the dot size to match other label". */
                  className={`rounded-full ${t === "proposed" && on ? "h-1 w-1" : "h-2 w-2"}`}
                  style={
                    t === "proposed" && on
                      ? {
                          backgroundColor: DOT_TONE[t].fill,
                          boxShadow: `0 0 0 1px #FFFFFF, 0 0 0 2px ${DOT_TONE[t].fill}`,
                        }
                      : t === "draft" && on
                        ? { backgroundColor: "#FFFFFF", border: `1.5px dashed ${DOT_TONE[t].fill}` }
                        : { backgroundColor: on ? DOT_TONE[t].fill : "#CBD5E1" }
                  }
                />
                {DOT_TONE[t].label}
              </button>
            );
          })}
          {hasSim && (
            <button
              type="button"
              onClick={() => setShowSim((v) => !v)}
              title={showSim ? "Hide simulated what-ifs" : "Show simulated what-ifs"}
              /* Matches the DOT_TYPES legend chip sizing (flat 10px,
                 no responsive bump — buyer 2026-07-19). */
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors hover:shadow-sm"
              style={{
                borderColor: showSim ? "#94A3B855" : "#E2E8F0",
                backgroundColor: showSim ? "#94A3B812" : "#FFFFFF",
                color: showSim ? "#334155" : "#94A3B8",
                textDecoration: showSim ? "none" : "line-through",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showSim ? "#94A3B824" : "#F8FAFC";
                e.currentTarget.style.borderColor = showSim ? "#94A3B899" : "#CBD5E1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showSim ? "#94A3B812" : "#FFFFFF";
                e.currentTarget.style.borderColor = showSim ? "#94A3B855" : "#E2E8F0";
              }}
            >
              <span
                className="h-2 w-2 rounded-full border-[1.5px] border-dashed bg-white"
                style={{ borderColor: showSim ? "#64748B" : "#CBD5E1" }}
              />
              Simulated
            </button>
          )}
        </div>

        {/* Right side: clear-added control + the dots/cards display toggle. */}
        <div className="flex shrink-0 items-center gap-2">
          {onClearAll && addedCount > 0 && (() => {
            /* Buyer feedback 2026-07-14: "the dropdown with only one
               item is over-engineered — one click should clear it".
               So the dropdown appears ONLY when both proposed POs
               AND simulations exist. In the single-bucket case the
               button clears directly (no chevron, no popover).
               Label stays a short "Clear + count" so it doesn't push
               the toolbar around; the tooltip carries the specific
               category being cleared. */
            const bothExist = proposedCount > 0 && simCount > 0;
            if (!bothExist) {
              const soloOnClick =
                proposedCount > 0 ? onClearProposedPOs : onClearSimulations;
              const soloTitle =
                proposedCount > 0
                  ? "Clear plotted purchase orders (real demand and incoming POs stay)"
                  : "Clear plotted simulations (real demand and incoming POs stay)";
              return (
                <button
                  type="button"
                  title={soloTitle}
                  onClick={() => soloOnClick?.()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <Trash2 className="size-3.5" />
                  Clear
                  <span className="grid h-[16px] min-w-[16px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white">
                    {addedCount}
                  </span>
                </button>
              );
            }
            return (
              <Popover open={clearMenuOpen} onOpenChange={setClearMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Clear plotted entries — purchase orders, simulations, or both (real demand and incoming POs stay)"
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 transition-colors hover:bg-rose-100 data-[state=open]:bg-rose-100"
                  >
                    <Trash2 className="size-3.5" />
                    Clear
                    <span className="grid h-[16px] min-w-[16px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white">
                      {addedCount}
                    </span>
                    <ChevronDown className="size-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={6} className="w-56 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClearProposedPOs?.();
                      setClearMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 className="size-3.5 text-slate-400" /> Clear purchase orders
                    </span>
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-slate-100 px-1 text-[11px] font-semibold tabular-nums text-slate-600">
                      {proposedCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearSimulations?.();
                      setClearMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 className="size-3.5 text-slate-400" /> Clear simulations
                    </span>
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-slate-100 px-1 text-[11px] font-semibold tabular-nums text-slate-600">
                      {simCount}
                    </span>
                  </button>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll?.();
                      setClearMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[13px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Trash2 className="size-3.5" /> Clear all
                    </span>
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold tabular-nums text-white">
                      {addedCount}
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
            );
          })()}

          {/* Event display toggle — compact dots vs. persistent cards. */}
          <div className="inline-flex items-center rounded-md border border-slate-200 p-0.5">
            {(["dots", "cards"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEventDisplay(m)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                  eventDisplay === m ? "bg-[#EFF6FF] text-[#0A77FF]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={chartBoxRef}
        className={`relative ${fillHeight ? "min-h-0 flex-1" : ""}`}
        style={fillHeight ? undefined : { height: chartH }}
        onClick={() => {
          /* Safety-net click-to-close: any click that bubbles this
             far (past the dot buttons + whole-plot layer) means the
             buyer clicked an inert region of the graph — close the
             pinned card. Dot buttons stopPropagation, so this never
             fires when a dot is clicked. */
          if (pinnedDay != null) setPinnedDay(null);
        }}
      >
        {/* Top-left note (buyer feedback 2026-07-20). Kept to a
            single line, no em-dash, small muted styling so it
            doesn't compete with the plot but is unmissable when the
            eye lands on the chart. Used to flag "your own POs are
            plotted here too" in Auto mode. */}
        {topLeftNote && (
          <div
            className="absolute left-2 top-2 z-10 pointer-events-none inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
            style={{ color: "#1E3A8A" }}
          >
            <Plus className="size-2.5" style={{ color: "#0A77FF" }} />
            {topLeftNote}
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 18, right: 12, bottom: 6, left: 4 }}
            /* Hover + click are owned by the HTML interaction layer below (it maps
               pointer→day deterministically for ANY day). The chart only clears
               hover when the pointer leaves it entirely. */
            onMouseLeave={() => {
              /* Defer the clear — moving onto the (now interactive) hover card
                 must not unmount it before its trash control can be clicked. */
              scheduleHoverClose();
            }}
          >
            <defs>
              {/* Under-curve fill — retinted to a soft green (was slate, which
                  read as grey against the healthy-band tone below the curve).
                  Keeps the curve area visible without introducing a
                  competing grey wash. */}
              <linearGradient id="inv-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F2F5F9" horizontal={false} />
            <CartesianGrid stroke={C_GRID} vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[winStart, horizonDays]}
              ticks={xTicks}
              interval={0}
              allowDecimals={false}
              tickFormatter={xTickFmt}
              tick={{ fontSize: gf(10), fill: "#94a3b8" }}
              tickLine={false}
              tickMargin={6}
              axisLine={{ stroke: C_GRID }}
              minTickGap={0}
            />
            <YAxis
              domain={yDomain}
              ticks={yAxisTicks}
              tick={renderYTick}
              interval={0}
              tickLine={false}
              axisLine={false}
              width={44}
            />

            {/* Threshold zones — soft coloured bands (no dotted lines).
                  · yDomain[1] → maxLevel = "Above max"  (TEAL — overstock)
                  · maxLevel   → minLevel = "Below max"  (light green,
                    "stock under the max ceiling but still healthy" —
                    label restored 2026-07-14 per buyer feedback so
                    the band reads consistently across the graph,
                    filters, listing, and tx table).
                  · minLevel   → 0        = "Below min"  (soft amber)
                  · 0          → yDomain[0] = "Below zero" (soft red) */}
            <ReferenceArea
              y1={yDomain[1]}
              y2={item.maxLevel}
              fill="#14B8A6"
              fillOpacity={0.14}
              stroke="none"
              label={{ value: "Above max", position: "insideTopRight", fontSize: gf(10), fill: "#115E59", fontWeight: 600 }}
            />
            <ReferenceArea
              y1={item.maxLevel}
              y2={item.minLevel}
              fill="#10B981"
              fillOpacity={0.05}
              stroke="none"
              label={{ value: "Below max", position: "insideTopRight", fontSize: gf(10), fill: "#047857", fontWeight: 600 }}
            />
            <ReferenceArea
              y1={item.minLevel}
              y2={0}
              fill={C_MIN}
              fillOpacity={0.08}
              stroke="none"
              label={{ value: "Below min", position: "insideTopRight", fontSize: gf(10), fill: "#B45309", fontWeight: 600 }}
            />
            <ReferenceArea
              y1={0}
              y2={yDomain[0]}
              fill={C_ZERO}
              fillOpacity={0.10}
              stroke="none"
              label={{ value: "Below zero", position: "insideTopRight", fontSize: gf(10), fill: "#B91C1C", fontWeight: 700 }}
            />
            {/* Min / max / zero threshold reference lines — the three
                horizontal anchors buyers eyeball for over/undershoot.
                No on-chart labels: the Y-axis already carries the
                numeric values on the left; a right-side label gets
                clipped to just "M" on narrow viewports. Buyer
                2026-07-22 asked for the zero line too (matches the
                pattern already established for min/max). */}
            <ReferenceLine
              y={item.maxLevel}
              stroke="#0D9488"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            <ReferenceLine
              y={item.minLevel}
              stroke="#B45309"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            <ReferenceLine
              y={0}
              stroke="#B91C1C"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            {/* Order-by — a subtle second anchor (lead time before need-by); its
                pill + drag handle live in the HTML overlay below. */}
            {orderByDay != null && orderByDay >= winStart && orderByDay <= horizonDays && (
              <ReferenceLine x={orderByDay} stroke={C_ORDERBY} strokeWidth={1.5} strokeDasharray="5 3" />
            )}
            {/* Need-by — a clear vertical reference to plan against; its labelled
                pill is drawn in the HTML overlay below for crisp legibility. */}
            {deadlineDay != null && deadlineDay >= winStart && deadlineDay <= horizonDays && (
              <ReferenceLine x={deadlineDay} stroke={C_DEADLINE} strokeWidth={1.5} strokeDasharray="5 3" />
            )}

            {/* Projected on-hand — split into a soft FILL and a crisp LINE so the
                planned-PO connectors can sit BETWEEN them: above the fill but
                UNDER the focused stock line (and under the event dots, which live
                in the HTML overlay). So the line reads as the clear hero and the
                connectors never paint over the data. monotone = soft shoulders,
                never overshoots; the daily curve keeps no-event stretches flat. */}
            <Area
              type="monotone"
              dataKey="atp"
              stroke="none"
              fill="url(#inv-fill)"
              dot={false}
              isAnimationActive={false}
            />
            {/* Planned-PO late guide only — the order-day diamond was
                dropped 2026-07-14 (buyer: "we don't need to show these
                diamonds"). What survives is the vertical dashed red
                guide on late arrivals; it's the only critical signal
                the diamond visual carried, and the receiving dot on
                the curve is already enough to communicate "PO lands
                here". */}
            <Customized
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={(cp: any) => {
                const links = shownEvents.filter(
                  (e) =>
                    e.kind === "proposed" &&
                    e.orderDay != null &&
                    e.orderDay < e.day &&
                    deadlineDay != null &&
                    e.day > deadlineDay,
                );
                if (links.length === 0) return null;
                const xm = cp?.xAxisMap || {};
                const ym = cp?.yAxisMap || {};
                const xScale = xm[Object.keys(xm)[0]]?.scale;
                if (!xScale) return null;
                const off = cp?.offset || {};
                const left = off.left ?? 0;
                const right = left + (off.width ?? 0);
                const top = off.top ?? 0;
                const bottom = top + (off.height ?? 0);
                const cx = (x: number) => Math.max(left, Math.min(right, x));
                return (
                  <g>
                    {links.map((e) => {
                      const rDay = Math.max(winStart, Math.min(horizonDays, e.day));
                      const rX = cx(xScale(rDay));
                      return (
                        <line
                          key={`late-guide-${e.id}`}
                          x1={rX}
                          y1={top}
                          x2={rX}
                          y2={bottom}
                          stroke="#DC2626"
                          strokeWidth={1}
                          strokeDasharray="2 3"
                          opacity={0.5}
                        />
                      );
                    })}
                  </g>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="atp"
              name="Projected on-hand"
              stroke={C_LINE}
              strokeWidth={2.75}
              dot={false}
              activeDot={{ r: 4, fill: C_LINE, stroke: "#FFFFFF", strokeWidth: 1.5 }}
              isAnimationActive={false}
            />

            {/* Dots view — one cluster series (fixed-footprint markers). */}
            {eventDisplay === "dots" && clusterData.length > 0 && (
              <Scatter data={clusterData} dataKey="atp" shape={clusterShape} isAnimationActive={false} />
            )}

            {/* Scale probe — captures Recharts' live scales for the HTML overlay. */}
            <Customized
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={(cp: any) => {
                const xm = cp?.xAxisMap || {};
                const ym = cp?.yAxisMap || {};
                const xScale = xm[Object.keys(xm)[0]]?.scale;
                const yScale = ym[Object.keys(ym)[0]]?.scale;
                if (!xScale || !yScale) return null;
                const off = cp?.offset || {};
                const next: PlotGeom = {
                  xScale,
                  yScale,
                  left: off.left ?? 0,
                  top: off.top ?? 0,
                  width: off.width ?? 0,
                  height: off.height ?? 0,
                };
                /* Re-render the overlay when the plot box OR the scale DOMAIN
                   changes. A window switch (30↔60↔90↔custom) keeps the same
                   pixel box but remaps the x domain, so an offset-only check
                   misses it — and the SVG overlay (order diamonds + connector
                   curves) would paint with a stale scale and detach from the
                   receiving dots Recharts re-positions. */
                const xd = (xScale.domain?.() ?? []) as number[];
                const yd = (yScale.domain?.() ?? []) as number[];
                const sig =
                  `${next.left},${next.top},${next.width},${next.height}|` +
                  `${xd[0]},${xd[xd.length - 1]}|${yd[0]},${yd[yd.length - 1]}`;
                plotGeomRef.current = next; // scales are new fns each render — always refresh
                if (geomSigRef.current !== sig) {
                  geomSigRef.current = sig;
                  queueMicrotask(() => setGeomTick((t) => t + 1));
                }
                return null;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* ── HTML overlay: hover affordance, day-detail card, cards view ── */}
        {geom && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {/* Whole-plot interaction layer — the single source of truth for
                hover + click-to-add. It maps the pointer to a day from the
                captured scale, so EVERY day is hoverable and clickable (not just
                where an event dot sits). Specific targets below (planned-point
                hit zones, cards, the pinned card) render later and capture their
                own clicks; everything else here opens the one shared chooser. */}
            {(canSimulate || canPlotVendor) && (
              <div
                className="absolute"
                style={{
                  left: geom.left,
                  top: geom.top,
                  width: geom.width,
                  height: geom.height,
                  pointerEvents: "auto",
                  cursor: plotCursor,
                  touchAction: "none",
                }}
                onMouseMove={(e) => {
                  /* While a dot drag is active, freeze the hovered day so the
                     floating day-card doesn't follow the pointer and collide
                     with the drag path. Cursor also stays `grabbing` for
                     visual feedback. */
                  if (dragActiveRef.current) {
                    if (plotCursor !== "grab") setPlotCursor("grab");
                    return;
                  }
                  cancelHoverClose();
                  const d = dayFromClientX(e.clientX);
                  if (d !== hoverDayRef.current) {
                    hoverDayRef.current = d;
                    setHoverDay(d);
                    onHoverDay?.(d);
                  }
                  const rect = chartBoxRef.current?.getBoundingClientRect();
                  /* Compute `hoverOnDot` for the CARD: pointer must be
                     within 24 px vertically of the ATP dot AND the day
                     must actually carry at least one event. Nothing here
                     affects the cursor / guide / click-to-add — those
                     stay driven by day alone. */
                  const dotAtp = d != null ? atpByDay.get(d) : undefined;
                  const hasEvents = d != null && eventsByDay.has(d);
                  let nextOnDot = false;
                  if (rect && dotAtp != null && hasEvents) {
                    const py = e.clientY - rect.top;
                    const dotY = geom.yScale(dotAtp);
                    nextOnDot = Math.abs(py - dotY) < 24;
                  }
                  if (nextOnDot !== hoverOnDotRef.current) setHoverOnDot(nextOnDot);
                  /* Cursor feedback — flip to "grab" when the pointer is
                     hovering directly over a draggable user-added dot; back
                     to "copy" otherwise (default create-on-empty affordance). */
                  const cluster = d != null ? clusterData.find((c) => c.day === d && c.draggableId) : null;
                  let next: "copy" | "grab" = "copy";
                  if (cluster && cluster.draggableId && rect) {
                    const py = e.clientY - rect.top;
                    const dotY = geom.yScale(cluster.atp);
                    if (Math.abs(py - dotY) < 18) next = "grab";
                  }
                  if (next !== plotCursor) setPlotCursor(next);
                }}
                onMouseLeave={() => {
                  /* Uses the 160 ms intent-bridge in scheduleHoverClose
                     so the buyer can still travel to the hover card
                     without it snapping shut. `hoverOnDot` is cleared
                     alongside `hoverDay` inside that timer. */
                  scheduleHoverClose();
                  if (plotCursor !== "copy") setPlotCursor("copy");
                }}
                onPointerDown={(e) => {
                  /* The whole-plot overlay used to hit-test for a
                     dot press near a draggable event and hand off to
                     the OLD `startDotDrag` (day-by-day store update
                     with no drag-preview). That was a SECOND drag
                     path — when the buyer's click landed near a dot
                     but slightly off the 44 px plan-hit button, it
                     took the old path instead of the modern one.
                     Removed 2026-07-15 (buyer feedback: "the dot
                     moves but the supply doesn't"). Only entry
                     point for drag is now the plan-hit HTML button
                     — one code path, one behavior. Overlay's
                     onClick still handles empty-area create-popover
                     clicks below. */
                  void e;
                }}
                onClick={(e) => {
                  if (clickSwallowRef.current) {
                    // The pointerdown started a drag on a dot — don't open
                    // the create popover on the follow-up click.
                    clickSwallowRef.current = false;
                    return;
                  }
                  const d = dayFromClientX(e.clientX);
                  if (d == null) {
                    if (pinnedDay != null) setPinnedDay(null);
                    return;
                  }
                  /* Click-on-dot pins the day-detail card so the buyer
                     can interact with it (open PR/PO links, remove
                     rows, etc.). Only user-added days had a per-dot
                     button before; regular events (PR / SO / PO /
                     draft) fell through to `openCreateAt` because
                     they're painted by the Recharts <Scatter> layer,
                     not a hit-target button. Feedback 2026-07-19:
                     "other than hover I don't have any ability to
                     stop this and click on any thing on this graph".
                     Detect "click near the ATP dot on a day with
                     events" (same 24 px Y-proximity gate used for
                     `hoverOnDot`) and pin it. */
                  const rect = chartBoxRef.current?.getBoundingClientRect();
                  const dotAtp = atpByDay.get(d);
                  const hasEvents = eventsByDay.has(d);
                  let nearDot = false;
                  if (rect && dotAtp != null && hasEvents) {
                    const py = e.clientY - rect.top;
                    const dotY = geom.yScale(dotAtp);
                    nearDot = Math.abs(py - dotY) < 24;
                  }
                  if (nearDot) {
                    setPinnedDay((p) => (p === d ? null : d));
                    return;
                  }
                  /* Click-anywhere-else closes a pinned card (buyer
                     feedback 2026-07-14). Card-preserving elements
                     (plan-hit / order-hit / chip buttons + the card
                     itself) already stopPropagation, so this branch
                     only fires on empty plot area. */
                  if (pinnedDay != null) {
                    setPinnedDay(null);
                    return;
                  }
                  const x = rect ? e.clientX - rect.left : geom.xScale(d);
                  const y = rect ? e.clientY - rect.top : geom.top;
                  openCreateAt(d, x, y);
                }}
              />
            )}

            {/* Any-day hover guide + column band + "click to add" affordance.
                All three children explicitly `pointer-events-none` so the
                overlays cannot catch drag pointerdown when they overlap the
                dot's plan-hit zone. The pill is additionally suppressed on
                days that already carry a draggable dot AND while a drag is
                armed — "click to add" is meaningless on a day you're
                rescheduling, and stacking it directly above the dot made
                buyers think it was catching the drag. */}
            {showHover && (() => {
              const hoverHasDraggable =
                effHoverDay != null &&
                clusterData.some((c) => c.day === effHoverDay && c.draggableId);
              const suppressPill = hoverHasDraggable || armedDay != null;
              return (
                <>
                  <div
                    className="pointer-events-none absolute bg-slate-100/60"
                    style={{ left: hoverCx - dayBandW / 2, top: geom.top, width: dayBandW, height: geom.height }}
                  />
                  <div
                    className="pointer-events-none absolute bg-slate-300"
                    style={{ left: hoverCx, top: geom.top, width: 1, height: geom.height }}
                  />
                  {(canSimulate || canPlotVendor) && !suppressPill && (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-500 shadow-sm"
                      style={{ left: hoverCx, top: geom.top + 2, fontSize: gf(10) }}
                    >
                      <Plus className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" />
                      click to add
                    </div>
                  )}
                </>
              );
            })()}

            {/* Floating day-detail card (dots view, or condensed chips on hover).
                Portalled to `document.body` with viewport-fixed coordinates so
                the graph card's `overflow-hidden` (or any ancestor clip) can't
                crop the wider (20rem) vendor rows. */}
            {showHoverCard &&
              (() => {
                const rect = chartBoxRef.current?.getBoundingClientRect();
                if (!rect) return null;
                const above = hoverCy > geom.top + geom.height / 2;
                const CARD_W = 20 * 16; // 20rem
                const localLeft = Math.max(4, Math.min(hoverCx - CARD_W / 2, rect.width - CARD_W - 4));
                const viewportLeft = rect.left + localLeft;
                const viewportTop = above
                  ? rect.top + hoverCy - 12 - 260
                  : rect.top + hoverCy + 12;
                /* HOVER card is read-only — `pointerEvents: none` so a
                   press near the dot (which may overlap the card's edge)
                   passes THROUGH to the overlay's drag handler instead of
                   the card catching it. Click a dot to PIN the card; that
                   version re-enables interaction. */
                const style: React.CSSProperties = {
                  position: "fixed",
                  left: viewportLeft,
                  top: viewportTop,
                  zIndex: 500,
                  pointerEvents: "none",
                };
                return createPortal(
                  <DayDetailCard
                    dateLabel={hoverDateLabel}
                    atp={hoverAtp}
                    baseUom={item.baseUom}
                    minLevel={item.minLevel}
                    events={hoverEvents}
                    vendorByName={vendorByName}
                    deadlineDay={deadlineDay}
                    /* Interactive on hover: the trash control shows for
                       user-added rows (simulations + vendor plots) so they can
                       be removed straight from the hover card — no click-to-pin
                       first. The hover-intent bridge keeps the card alive while
                       the pointer travels onto it. */
                    onRemoveEvent={onRemoveEvent}
                    onEditEvent={onEditSupplyRequested}
                    scroll
                    onMouseEnter={cancelHoverClose}
                    onMouseLeave={scheduleHoverClose}
                    /* Vendor-suggestion inputs — the card renders a "Fulfill
                       with a vendor" section when the hovered day carries a
                       simulated supply event. */
                    item={item}
                    qualifiedVendors={vendors}
                    onSuggestVendor={onPlotVendor}
                    hoverDay={effHoverDay ?? undefined}
                    style={style}
                  />,
                  document.body,
                );
              })()}

            {/* Cards view — leader lines + anchor dots + consolidated cards. */}
            {eventDisplay === "cards" && cardLayout && cardLayout.items.length > 0 && (
              <>
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {cardLayout.items.map((it) => {
                    const cardW = cardLayout.mode === "chip" ? gs(CHIP_W) : gs(CARD_W);
                    const anchorX = Math.max(it.x + 10, Math.min(it.x + cardW - 10, it.cx));
                    const anchorY = it.y + it.h;
                    return (
                      <g key={it.day}>
                        <line x1={it.cx} y1={it.cy} x2={anchorX} y2={anchorY} stroke="#CBD5E1" strokeWidth={1} />
                        <circle cx={it.cx} cy={it.cy} r={3} fill="#475569" stroke="#FFFFFF" strokeWidth={1.5} />
                      </g>
                    );
                  })}
                </svg>
                {cardLayout.items.map((it) => {
                  const dateLabel =
                    fmtRealDate(dateByDay.get(it.day)) || (it.day === 0 ? "Today" : `+${it.day}d`);
                  // Parity with dots view: a card/chip whose day holds a
                  // just-added entry gets the same attention ring; pinned tracks
                  // whether its detail card is open (chip mode).
                  const justAdded = it.evs.some((e) => justAddedIds.has(e.id));
                  const isPinned = pinnedDay === it.day;
                  const tones = Array.from(new Set(it.evs.map(eventTone))).slice(0, 4);
                    return (
                      <button
                        key={it.day}
                        type="button"
                        onMouseEnter={() => {
                          setHoverDay(it.day);
                          onHoverDay?.(it.day);
                          /* Chip is the dot-equivalent in cards view —
                             hovering it means the buyer is on a real
                             event target, so the hover card is allowed
                             to appear. Without this, my dot-proximity
                             gate for `showHoverCard` would silently
                             suppress the card in chip mode. */
                          if (!hoverOnDotRef.current) setHoverOnDot(true);
                        }}
                        onMouseLeave={() => {
                          /* Uses the 160 ms intent-bridge so the buyer
                             can travel from the chip to the floating
                             card without it snapping shut. */
                          scheduleHoverClose();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinned(it.day);
                        }}
                        title="View or remove this day's entries"
                        aria-pressed={isPinned}
                        className="pointer-events-auto absolute flex items-center gap-1 rounded-md border bg-white px-1.5 shadow-sm transition-colors hover:border-slate-300"
                        style={{
                          left: it.x,
                          top: it.y,
                          width: gs(CHIP_W),
                          height: gs(CHIP_H),
                          borderColor: isPinned ? "#0A77FF" : justAdded ? "#2563EB" : "#E2E8F0",
                          boxShadow: justAdded ? "0 0 0 2px rgba(10,119,255,0.35)" : undefined,
                        }}
                      >
                        <span className="truncate font-semibold text-slate-600" style={{ fontSize: gf(9.5) }}>{dateLabel}</span>
                        <span className="flex items-center gap-0.5">
                          {tones.map((c, i) => (
                            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
                          ))}
                        </span>
                        <span className="ml-auto font-bold tabular-nums text-slate-400" style={{ fontSize: gf(9.5) }}>
                          {it.evs.length}
                        </span>
                      </button>
                    );
                })}
              </>
            )}

            {/* Need-by + Order-by — two draggable anchor lines (drag the line or
                its pill; click a pill to pick a date). Order-by is the subtle
                second line a lead-time before need-by. */}
            {renderDeadlineLine({
              key: "orderby",
              day: orderByDay,
              color: C_ORDERBY,
              label: "Order by",
              dateText:
                orderByDay != null
                  ? fmtRealDate(dateByDay.get(orderByDay)) || fmtDayDate(orderByDay)
                  : "",
            })}
            {renderDeadlineLine({
              key: "needby",
              day: deadlineDay,
              color: C_DEADLINE,
              label: "Need by",
              dateText:
                deadlineDay != null
                  ? fmtRealDate(dateByDay.get(deadlineDay)) || fmtDayDate(deadlineDay)
                  : "",
            })}

            {/* Shared inline calendar for whichever anchor is being edited —
                portaled to body so the plot's overflow-hidden can't clip it. */}
            {(canEditNeedBy || canEditOrderBy) &&
              editLine &&
              editAnchor &&
              (() => {
                const isNeedBy = editLine === "needby";
                const curDay = isNeedBy ? deadlineDay : orderByDay;
                if (curDay == null) return null;
                const isManual = isNeedBy ? needByIsManual : orderByIsManual;
                const autoDay = isNeedBy ? needByAutoDay : orderByAutoDay;
                return createPortal(
                  <div
                    ref={linePopRef}
                    className="fixed z-[400] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
                    style={{
                      left: Math.max(140, Math.min(editAnchor.cx, window.innerWidth - 140)),
                      top: editAnchor.top,
                    }}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-3 px-0.5">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold text-slate-700">
                          {isNeedBy ? "Need by" : "Order by"}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                          {isNeedBy
                            ? "Set the date when items must be in the warehouse."
                            : "Set the date when the purchase order will be placed."}
                        </p>
                      </div>
                      {isManual && autoDay != null && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isNeedBy) onNeedByChange?.(null);
                            else onOrderByChange?.(null);
                            setEditLine(null);
                          }}
                          className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-slate-500 transition-colors hover:text-rose-600"
                          title="Remove this line from the graph"
                        >
                          <Trash2 className="size-3" /> Remove
                        </button>
                      )}
                    </div>
                    <div className="inline-block rounded-md border border-input">
                      <Calendar
                        mode="single"
                        showOutsideDays={false}
                        selected={pendingLineDate ?? undefined}
                        defaultMonth={pendingLineDate ?? dayToDateLocal(curDay)}
                        onSelect={(d) => d && setPendingLineDate(d)}
                        numberOfMonths={1}
                        disabled={[
                          { before: dayToDateLocal(0) },
                          { after: dayToDateLocal(horizonDays) },
                        ]}
                        className="p-2"
                      />
                    </div>
                    {/* Explicit commit — a day-click only highlights; Apply moves the line. */}
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditLine(null)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!pendingLineDate}
                        onClick={() => {
                          if (!pendingLineDate) return;
                          const picked = Math.max(0, Math.min(horizonDays, dayFromDateLocal(pendingLineDate)));
                          commitLineDay(editLine, picked);
                          setEditLine(null);
                        }}
                        className="rounded-md bg-[#0A77FF] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Apply
                      </button>
                    </div>
                    {recommendedLeadDays != null && (
                      <p className="mt-1.5 max-w-[220px] px-0.5 text-[10px] leading-snug text-slate-500">
                        {isNeedBy ? (
                          <>
                            {recommendedLeadDays}-day lead — to arrive in time, order by about{" "}
                            <span className="font-semibold text-slate-700">
                              {fmtDayDate(curDay - recommendedLeadDays)}
                            </span>
                            .
                          </>
                        ) : (
                          <>
                            {recommendedLeadDays}-day lead — order here and expected delivery is{" "}
                            <span className="font-semibold text-slate-700">
                              {fmtDayDate(curDay + recommendedLeadDays)}
                            </span>
                            .
                          </>
                        )}
                      </p>
                    )}
                  </div>,
                  document.body,
                );
              })()}

            {/* (Planned-PO → receiving links moved INTO the chart, under the
                line + dots — see the <Customized> after the fill <Area> above.) */}

            {/* Planned-point hit targets (dots view) — big, easy-to-click
                zones over each green plan. Short press = click → togglePinned;
                press-and-drag = reschedule → startDotDrag with the
                cluster's draggableId (the underlying event's id). This is
                the ROOT drag target — the plot overlay below is a fallback
                for empty-space clicks. */}
            {eventDisplay === "dots" &&
              userAddedDays.map((day) => {
                const cx = geom.xScale(day);
                const cy = geom.yScale(atpByDay.get(day) ?? 0);
                const isPin = pinnedDay === day;
                const cluster = clusterData.find((c) => c.day === day);
                const dragId = cluster?.draggableId;
                /* If this cluster is being dragged, re-anchor the
                   button's Y to the projected-stock curve at the
                   FRACTIONAL cursor day (linear interp between the
                   two neighbouring integer days). Rounding would
                   snap the preview off the line whenever ATP moves
                   sharply between two days. X still uses the raw
                   pointer delta (`offsetX`) so horizontal motion is
                   smooth. */
                const isBeingDragged =
                  !!(dragPreview && dragId && dragPreview.id === dragId);
                let previewCy = cy;
                const previewLeft = cx;
                let previewTransform: string | undefined = undefined;
                if (isBeingDragged && dragPreview.previewDay != null) {
                  const fd = dragPreview.previewDay;
                  /* Free-drag preview — no magnetic snap. X follows
                     the raw pointer delta so the dot glides pixel-
                     for-pixel with the cursor. Y linearly
                     interpolates ATP between the two nearest integer
                     days so the preview stays on the projected
                     curve. Buyer feedback 2026-07-15: auto-snap
                     kept moving supplies to days they didn't
                     intend. Commit uses the same raw position. */
                  const lo = Math.floor(fd);
                  const hi = Math.ceil(fd);
                  const t = fd - lo;
                  const vLo = atpByDay.get(lo) ?? 0;
                  const vHi = atpByDay.get(hi) ?? vLo;
                  const interpAtp = vLo + (vHi - vLo) * t;
                  previewCy = geom.yScale(interpAtp);
                  previewTransform = `translate(calc(-50% + ${dragPreview.offsetX}px), -50%)`;
                }
                return (
                  <button
                    key={`plan-hit-${day}`}
                    type="button"
                    onMouseEnter={() => {
                      cancelHoverClose();
                      hoverDayRef.current = day;
                      setHoverDay(day);
                      onHoverDay?.(day);
                      /* Inside the 44 px hit-target means we're on the
                         dot — hover card is allowed to appear. */
                      if (!hoverOnDotRef.current) setHoverOnDot(true);
                    }}
                    /* Native pointer-capture drag — the button OWNS the
                       pointer for the whole gesture, so subsequent
                       pointermove/pointerup events fire on THIS element
                       regardless of where the pointer travels. Fixes the
                       intermittent "drag never starts" behaviour where
                       document-level listeners were being pre-empted by
                       hover cards + other overlay layers. */
                    onPointerDown={(e) => {
                      /* Snapshot-view lock: drag-to-reschedule is frozen
                         while viewing a snapshot (buyer 2026-07-20). */
                      if (viewOnly) return;
                      setDebugStatus(`down · id=${dragId ?? "MISSING"} day=${day}`);
                      if (!dragId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      dotDragRef.current = false;
                      dragActiveRef.current = true;
                      setArmedDay(day);
                      setPinnedDay(null);
                      hoverDayRef.current = null;
                      setHoverDay(null);
                      dragStartXRef.current = e.clientX;
                      dragIdRef.current = dragId;
                      const capturedId = dragId;
                      let moveCount = 0;
                      let lastClientX = e.clientX;
                      /* Free-drag: we translate the button visually on
                         every pointermove without touching store state.
                         The final day-integer is committed once on
                         pointerup so the dot glides smoothly with the
                         cursor rather than jumping through days. */
                      /* Closure-local tracker for the last fractional day
                         the drag preview saw. Refs (as opposed to reading
                         `dragPreview` state via closure) update
                         synchronously and are readable in onUp without
                         staleness. */
                      let lastPreviewDay: number | null = null;
                      const onMove = (ev: PointerEvent) => {
                        if (!dragActiveRef.current) return;
                        moveCount++;
                        lastClientX = ev.clientX;
                        const offsetX = ev.clientX - dragStartXRef.current;
                        if (!dotDragRef.current && Math.abs(offsetX) > 2) {
                          dotDragRef.current = true;
                          clickSwallowRef.current = true;
                        }
                        if (!dotDragRef.current) {
                          setDebugStatus(`waiting · dx=${offsetX}`);
                          return;
                        }
                        const dayPreview = fractionalDayFromClientX(ev.clientX);
                        lastPreviewDay = dayPreview;
                        setDragPreview({ id: capturedId, offsetX, previewDay: dayPreview });
                        setDebugStatus(
                          `drag · id=${capturedId} dx=${offsetX} → day=${dayPreview != null ? dayPreview.toFixed(1) : "—"} moves=${moveCount}`,
                        );
                      };
                      const onUp = (ev: PointerEvent) => {
                        document.removeEventListener("pointermove", onMove);
                        document.removeEventListener("pointerup", onUp);
                        document.removeEventListener("pointercancel", onUp);
                        /* Prefer the pointerup's own clientX (it's the
                           actual release position); fall back to the
                           closure's lastClientX for pointercancel or
                           any edge case where clientX isn't provided. */
                        const releaseX =
                          typeof ev.clientX === "number" && !Number.isNaN(ev.clientX)
                            ? ev.clientX
                            : lastClientX;
                        dragActiveRef.current = false;
                        dragIdRef.current = null;
                        setArmedDay(null);
                        /* Snap + commit BEFORE clearing dragPreview so
                           the state update batches with the button's
                           un-translate. Buyer feedback 2026-07-14: if
                           the release lands near an existing event
                           day, snap onto it so the PO merges into the
                           same cluster (blue ring around the demand
                           stack) rather than landing standalone one
                           day off. Threshold is half a day-width. */
                        if (dotDragRef.current) {
                          /* Simple commit — no magnetic snap. Round
                             the raw drop position to a day integer
                             and commit there. Buyer feedback
                             2026-07-15: automatic snap-to-nearest-
                             event kept moving supplies to days the
                             buyer didn't intend. If a merge is
                             wanted, the buyer can drop directly on
                             the demand day themselves. */
                          const rawFractional =
                            lastPreviewDay ?? fractionalDayFromClientX(releaseX);
                          const finalDay =
                            rawFractional != null
                              ? Math.max(winStart, Math.min(horizonDays, Math.round(rawFractional)))
                              : null;
                          setDebugStatus(`up · id=${capturedId} day=${finalDay ?? "—"} moves=${moveCount}`);
                          if (finalDay != null) onMoveEvent(capturedId, finalDay);
                        } else {
                          setDebugStatus("");
                        }
                        setDragPreview(null);
                        setTimeout(() => {
                          dotDragRef.current = false;
                          setDebugStatus("");
                        }, 4000);
                      };
                      document.addEventListener("pointermove", onMove);
                      document.addEventListener("pointerup", onUp);
                      document.addEventListener("pointercancel", onUp);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Ignore the synthetic click that follows a drag.
                      if (dotDragRef.current) return;
                      togglePinned(day);
                    }}
                    title={
                      dragId
                        ? isPin
                          ? "Hide planned details (drag to reschedule)"
                          : "View planned details (drag to reschedule)"
                        : isPin
                          ? "Hide planned details"
                          : "View planned details"
                    }
                    aria-label="Toggle planned point details"
                    className={`group/planhit pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow ${
                      armedDay === day
                        ? "ring-2 ring-blue-500/80 shadow-[0_0_0_4px_rgba(59,130,246,0.18)]"
                        : dragId
                          ? "hover:ring-2 hover:ring-blue-400/50"
                          : ""
                    }`}
                    style={{
                      left: isBeingDragged ? previewLeft : cx,
                      top: isBeingDragged ? previewCy : cy,
                      width: 44,
                      height: 44,
                      cursor: dragId
                        ? armedDay === day
                          ? "grabbing"
                          : "grab"
                        : "pointer",
                      touchAction: dragId ? "none" : undefined,
                      /* During drag: transform provides the smooth
                         pointer-delta X translate when in free-drag
                         mode; when snapped to an event day, transform
                         is undefined and the button is positioned by
                         `left`/`top` alone (hard snap). */
                      transform: isBeingDragged ? previewTransform : undefined,
                      /* Above the need-by / order-by anchor drag strip
                         (`renderDeadlineLine` uses zIndex 30). */
                      zIndex: 32,
                    }}
                  >
                    {/* Preview marker — visible ONLY while this
                        event is being dragged. Renders as a BAR
                        (matches the post-drop scatter rendering)
                        so mid-drag and post-drop look identical —
                        buyer won't confuse a mid-drag preview with
                        a committed state (they've been screenshot-
                        ting mid-drag and thinking the commit
                        didn't happen). Buyer feedback 2026-07-15. */}
                    {isBeingDragged && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded"
                        style={{
                          width: 11,
                          height: 7,
                          backgroundColor: DOT_TONE.proposed.fill,
                          boxShadow: `0 0 0 1px #FFFFFF`,
                        }}
                      />
                    )}
                    {/* Discoverability chevrons — hidden during an
                        active drag (the preview dot IS the cue at
                        that point). */}
                    {dragId && !isBeingDragged && (
                      <>
                        <ChevronLeft
                          className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] size-3 text-blue-500 transition-opacity ${
                            armedDay === day
                              ? "opacity-90"
                              : "opacity-0 group-hover/planhit:opacity-80"
                          }`}
                        />
                        <ChevronRight
                          className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-[2px] size-3 text-blue-500 transition-opacity ${
                            armedDay === day
                              ? "opacity-90"
                              : "opacity-0 group-hover/planhit:opacity-80"
                          }`}
                        />
                      </>
                    )}
                  </button>
                );
              })}

            {/* Order-diamond hit target removed 2026-07-14: the diamond
                visual it sat over is gone (see the Customized block
                that now only draws the late-guide). Buyer report: this
                overlay was also occasionally catching pointerdown
                intended for the plan-hit drag button. */}

            {/* Pinned detail card — opened by clicking a green point (dots) or a
                condensed chip (cards), closed by clicking it again (or adding
                elsewhere). Brings view + delete parity to the chip layout.
                Portalled to `document.body` with viewport-fixed coordinates
                so the graph card's `overflow-hidden` (or any ancestor clip)
                can't crop it — the widened 20rem vendor rows need room to
                extend past the graph card boundary. */}
            {(eventDisplay === "dots" || cardLayout?.mode === "chip") &&
              pinnedDay != null &&
              eventsByDay.has(pinnedDay) &&
              (() => {
                const rect = chartBoxRef.current?.getBoundingClientRect();
                if (!rect) return null;
                const cx = geom.xScale(pinnedDay);
                const atp = atpByDay.get(pinnedDay);
                const cy = atp != null ? geom.yScale(atp) : geom.top;
                const above = cy > geom.top + geom.height / 2;
                const CARD_W = 20 * 16; // 20rem
                const localLeft = Math.max(4, Math.min(cx - CARD_W / 2, rect.width - CARD_W - 4));
                const viewportLeft = rect.left + localLeft;
                /* Offset the pinned card outside the plan-hit button's
                   44 px hit zone (± 22 px from cy). Previously 16 px
                   put the card's edge INSIDE the drag zone, so the
                   card at z-500 intercepted pointerdown intended for
                   the drag button. Buyer feedback 2026-07-14: "the
                   layering/pop-up is catching the drag". 28 px gives
                   a comfortable 6 px margin past the button. */
                const CARD_GAP = 28;
                const viewportTop = above
                  ? rect.top + cy - CARD_GAP - 260 /* card approx height; anchored above */
                  : rect.top + cy + CARD_GAP;
                const style: React.CSSProperties = {
                  position: "fixed",
                  left: viewportLeft,
                  top: viewportTop,
                  zIndex: 500,
                  pointerEvents: "auto",
                };
                const dateLabel =
                  fmtRealDate(dateByDay.get(pinnedDay)) || (pinnedDay === 0 ? "Today" : `+${pinnedDay}d`);
                return createPortal(
                  <div ref={pinnedCardRef} style={{ display: "contents" }}>
                    <DayDetailCard
                      dateLabel={dateLabel}
                      atp={atp}
                      baseUom={item.baseUom}
                      minLevel={item.minLevel}
                      events={eventsByDay.get(pinnedDay)!}
                      vendorByName={vendorByName}
                      deadlineDay={deadlineDay}
                      onRemoveEvent={onRemoveEvent}
                      onEditEvent={onEditSupplyRequested}
                      scroll
                      item={item}
                      qualifiedVendors={vendors}
                      onSuggestVendor={onPlotVendor}
                      hoverDay={pinnedDay}
                      style={style}
                    />
                  </div>,
                  document.body,
                );
              })()}
          </div>
        )}

        {/* Plot-click → a small chooser at the click point: add demand, add
            supply, or add a qualified vendor. Each path renders in place; on
            commit the parent re-projects the curve and a marker lands. */}
        {simAnchor &&
          (canSimulate || canPlotVendor) &&
          (() => {
            /* Rendered in a PORTAL to <body> with position:fixed so the panel's
               `overflow-hidden` (the rounded-xl clip) can NEVER cut the popover
               off when it's taller than the chart area. simAnchor.x/y are
               relative to the chart box, so convert to viewport coords via its
               rect, then flip/clamp against the VIEWPORT (not the box). The card
               also caps at the viewport height and scrolls internally as a final
               guard for very short windows — so it never clips. */
            const rect = chartBoxRef.current?.getBoundingClientRect();
            /* CARD_POP_W MUST match the modal's declared width
               (`w-[440px]` on the wrapper div below) — the flip /
               clamp math uses this to decide whether the popover
               fits to the right of the anchor or has to flip left,
               and clamps its final `left` so the modal stays fully
               inside the viewport. Using a smaller constant (was
               320) caused the actual 440px modal to overflow by up
               to 120px on the right, clipping the Timing step dot,
               UoM select, and primary button. Buyer feedback
               2026-07-15. */
            /* Widened 440 → 560 (buyer feedback 2026-07-16: "modal too
               small — once you've clicked the dot and have the date,
               the vendor-selection step especially is really squished
               with a scroll issue"). Flip/clamp math already viewport-
               clamps via `maxPopWScaled`, so the wider constant only
               takes effect when the viewport can accommodate it. */
            const CARD_POP_W = 560;
            /* 520 → 760 (buyer 2026-07-23: "no scroll on this modal
               for smaller or larger screens; need everything visible").
               Step 2 needs enough room for the vendor list to render
               every row (up to ~7 vendors + Missing-your-vendor + amber
               late-warning + step controls) with no internal scroll.
               The viewport clamp below still bounds this so the modal
               never leaves the screen. */
            const CARD_POP_H = 760;
            /* The card lives in a body portal, so it can't inherit the chart's
               `--gs` scale. Scale the whole popover with a transform so it grows
               on 2K/4K like the rest of the surface (never below 1×), and clamp
               against the SCALED footprint so it still flips / fits the viewport. */
            const popScale = Math.max(1, uiScale);
            const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
            const vh = typeof window !== "undefined" ? window.innerHeight : 800;
            /* If the scaled modal is wider than the viewport (very
               narrow window), shrink both the internal declared
               width AND the clamp math so nothing overflows. */
            const maxPopWScaled = Math.max(200, vw - 16);
            const popW = Math.min(CARD_POP_W * popScale, maxPopWScaled);
            const effectiveInternalWidth = popW / popScale;
            const ax = (rect?.left ?? 0) + simAnchor.x;
            const ay = (rect?.top ?? 0) + simAnchor.y;
            /* Modal placement — buyer 2026-07-23 clarifications:
                 · "this needs to be open on graph" — top edge stays
                   inside the graph rect (never floats above it into
                   the workspace header).
                 · "extend the height on the modal but don't need to
                   open this much above" — extend downward from the
                   click; if there isn't enough room below, shift up
                   ONLY as far as `graphTop + 8`, no further.

               Result: modal top is anchored to the click, floored at
               the graph's top. Height fills the room from that top
               down to the viewport bottom (minus 8px gutter). Inner
               scroll wrapper still exists as a safety net for the
               very-short-viewport case. */
            const graphTop = rect?.top ?? 0;
            /* Floor is `graphTop − 48` — the modal top edge can poke
               up into the workspace header by up to ~48px so the
               wizard's Step 2 vendor list + Missing-your-vendor row
               + footer all stay visible without an internal scroll
               (buyer 2026-07-23: "a bit scroll, I need to see full
               missing your vendor button"). Still bounded to 8px
               from the viewport top so it can never leave the page. */
            const graphFloor = Math.max(8, graphTop - 48);
            const desiredH = Math.min(CARD_POP_H * popScale, Math.max(200, vh - 16));
            /* Anchor at click, floored at graph top. */
            let top = Math.max(graphFloor, ay - 8);
            /* If the modal at that top would overflow the viewport
               bottom, shift up — but never past the graph top. */
            const overflowBottom = top + desiredH - (vh - 8);
            if (overflowBottom > 0) {
              top = Math.max(graphFloor, top - overflowBottom);
            }
            /* Actual height = whichever is smaller, the desired height
               or the room from `top` down to the viewport bottom. */
            const popH = Math.min(desiredH, Math.max(240, vh - top - 8));
            /* Prefer right-of-anchor placement; flip left when it
               would overflow the right edge; final clamp keeps the
               modal fully inside the viewport width. */
            let left = ax + 12;
            if (left + popW > vw - 8) left = ax - popW - 12;
            left = Math.max(8, Math.min(left, vw - popW - 8));
            const availableModalHeight = popH;
            /* Fallback to computing the ISO from the day offset if
               dateByDay is missing that day (edge case when the click
               lands outside the currently rendered curve range).
               Without this the wizard would receive an undefined
               anchorDate and its SystemDatePicker would open on
               today's month instead of the clicked day. */
            const iso = dateByDay.get(simAnchor.day) ?? (() => {
              const d = dayToDateLocal(simAnchor.day);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              return `${y}-${m}-${dd}`;
            })();
            const close = () => setSimAnchor(null);
            /* Outside-click discard guard (buyer feedback 2026-07-16):
               the Simulate-supply wizard now tracks a dirty flag; when
               the overlay is clicked we defer to `requestClose()` on
               the wizard's handle. If the wizard consumed the request
               (dirty → showed its own confirm strip) we DON'T close;
               otherwise we fall through to the direct dismiss so
               pristine surfaces still behave as before. */
            const attemptOutsideClose = () => {
              const handled = supplyWizardHandleRef.current?.requestClose();
              if (!handled) close();
            };
            return createPortal(
              <>
                {/* No full-screen backdrop — buyer 2026-07-19 reported
                    that with the popover open, clicking the Auto or
                    Clear buttons (or anything else in the graph header)
                    was eaten by an invisible layer. That layer was a
                    `fixed inset-0` catcher we used to dismiss the
                    popover on outside click. Replaced with a
                    document-level mousedown listener wired up below
                    (see `useEffect` on `simAnchor`) — same dismissal
                    behavior, but clicks pass through to their real
                    targets so the buyer can hop from the popover
                    straight onto Auto/Clear without a dead second
                    click. `attemptOutsideClose` still exists as the
                    dismissal path — the listener calls it. */}
                <div
                  ref={chooserWrapRef}
                  data-supply-modal="true"
                  className="fixed z-[61] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                  style={{
                    left,
                    top,
                    width: effectiveInternalWidth,
                    maxHeight: availableModalHeight / popScale,
                    transform: `scale(${popScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <PlannerAddChooser
                    item={item}
                    vendors={vendors}
                    allVendors={allVendors}
                    anchorDate={iso}
                    anchorDay={simAnchor.day}
                    atWindowEnd={simAnchor.day >= horizonDays}
                    deadlineDay={deadlineDay}
                    unitsToCover={unitsToCover}
                    supplyWizardHandleRef={supplyWizardHandleRef}
                    /* Edit-in-place — when the chooser is opened via
                       an edit request, skip the type-choose step and
                       drop straight into the supply wizard with the
                       original vendor + qty pre-filled. */
                    initialStep={editingSupplyRequest ? "supply" : undefined}
                    initialQty={editingSupplyRequest?.qty}
                    initialVendorId={editingSupplyRequest?.vendorId}
                    onSimulateAdd={
                      onSimulateAdd
                        ? (data) => {
                            armedRef.current = true;
                            onSimulateAdd(data);
                          }
                        : undefined
                    }
                    onPlotVendor={
                      onPlotVendor
                        ? (vendorId, day, qty, plan) => {
                            armedRef.current = true;
                            onPlotVendor(vendorId, day, qty, plan);
                          }
                        : undefined
                    }
                    onClose={() => {
                      /* Any close path (commit or dismiss) that
                         happens while an edit is in flight lets the
                         host clear its editing state. `armedRef`
                         being true means a commit fired; a false
                         value here means the buyer bailed, and we
                         still want the host's editing id cleared so
                         the next plot isn't accidentally treated as
                         a replace. */
                      if (editingSupplyRequest && onEditSupplyCancel) onEditSupplyCancel();
                      close();
                    }}
                  />
                </div>
              </>,
              document.body,
            );
          })()}
      </div>
    </div>
  );
}
