/* ═══════════════════════════════════════════════════════════════
   PROCUREMENT PLANNING — full-screen workspace
   Route: /purchase-orders/plan/:itemCode

   The surface a buyer enters from the Procurement Planning listing
   (clicking a row). It replaces the old PlannerSandboxModal overlay with
   a dedicated full-page route (per product direction) and supports
   planning several items at once via tabs across the top — each tab is
   one item, driven by the route param + the `plannerSession` store.

   Two planning surfaces, switched by the Timeline ↔ Classic toggle:
     • Timeline — the Gantt canvas (default): the whole item on one axis.
     • Classic  — a two-column layout:
         · Left  — Qualified vendors (interactive allocation, ≤5/item)
         · Right — Gap Graph (projected ATP vs thresholds) on top,
                   Transaction Table (incoming/outgoing) underneath.

   The qualified-vendor panel owns vendor selection + per-vendor
   allocation; the Gap Graph and Transaction Table render from real data.
   ═══════════════════════════════════════════════════════════════ */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  X,
  Package,
  RotateCcw,
  ShoppingCart,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CalendarDays,
  CheckCircle2,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Check,
  Plus,
  Sparkles,
  Columns3,
  Rows2,
  Camera,
  Info,
} from "lucide-react";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import type {
  ImperativePanelHandle,
  ImperativePanelGroupHandle,
} from "react-resizable-panels";

import {
  PLANNER_ITEMS,
  getDemandEventsForItem,
  getFutureIncomingForItem,
  getSeededIncomingForItem,
  getDraftPOsForItem,
  getSeededDraftPOForItem,
  expandVendorsForItem,
  expandAllVendorsForItem,
  vendorConstraints,
  categoryCodeFor,
  getItemPORecommendationRule,
  PO_RECOMMENDATION_RULES,
  type PlannerItem,
  type PlannerVendor,
  type PlannerSeverity,
  type PlannerDemandEvent,
  type FutureIncomingEvent,
  type PlanMode,
  type PORecommendationRule,
} from "./plannerData";
import {
  projectAtpCurve,
  worstSeverityInHorizon,
  firstViolationDate,
  currentAtp as currentAtpOfCurve,
  outstandingQty,
  effectivePrice,
  type ProjectionPoint,
} from "../utils/projection";
import PlannerGapGraph, { type GapGraphEvent } from "./PlannerGapGraph";
import PlannerVendorPanel from "./PlannerVendorPanel";
import PlannerPricingRuleBadge from "./PlannerPricingRuleBadge";
import { VendorLogo } from "./vendorLogo";
import PlannerTimelineCanvas from "./PlannerTimelineCanvas";
import {
  PlannerManageItemsModal,
  type PlannerInventoryItem,
} from "./PlannerManageItemsModal";
import { addToCart, getCart, subscribeToCart } from "./cartStore";
import type { CatalogItem } from "./catalogData";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { toast } from "sonner";
import {
  getAllPOs,
  subscribeToPOStore,
  type PurchaseOrderData,
} from "./poStore";
import UnifiedTransactionStream, {
  SimulateEntryButton,
  type SimulatedTxn,
  type PlannedIncomingTxn,
  type TransactionDirection,
} from "./UnifiedTransactionStream";
import {
  useOpenPlannerItems,
  openPlannerItem,
  closePlannerItem,
  usePlannerGroupBy,
  setPlannerGroupBy,
  setLastActiveItem,
  type PlannerGroupBy,
} from "./plannerSession";
import {
  useRecommendationMode,
  useRecommendationConfig,
  setRecommendationConfig,
  computeAutoSupplyEvents,
  ITEM_MASTER_DEFAULT_CONFIG,
  OFF_CONFIG,
  type RecommendationMode,
  type RecommendationConfig,
  type RecommendationTrigger,
  type RecommendationFillTo,
  type AutoSupplyEvent,
} from "./plannerRecommendationStore";
import {
  addSnapshot,
  diffSnapshotWorld,
  summarizeDiff,
  useSnapshotsForItem,
  type PlannerSnapshot,
  type PlannerSnapshotIntent,
  type PlannerSnapshotWorld,
  type SnapshotWorldDiff,
} from "./plannerSnapshotStore";
import { PlannerSnapshotsDrawer } from "./PlannerSnapshotsDrawer";
import { PlannerSnapshotCompare } from "./PlannerSnapshotCompare";
import { SnapshotBanner, SnapshotFrameOverlay } from "./PlannerSnapshotViewChrome";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "./ui/alert-dialog";
import { useSandboxVariant, setSandboxVariant } from "./plannerVariantStore";
import { getPlannerUserMode } from "./plannerDevMode";
import { PlannerDevWidget } from "./PlannerDevWidget";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import BackButton from "./BackButton";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Calendar } from "./ui/calendar";
import type { DateRange } from "react-day-picker";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

/* ── Free-form sandbox layout (Classic view) ──
   Qualified vendors is PINNED to the left (not draggable) and collapses to a
   vertical rail. The other two panels — Gap Graph · Transaction Table — are the
   react-dnd cards to its right: drag a card by its title bar to reorder, pick a
   Small / Medium / Large width per card, fold a card to its title bar. Order +
   sizes + per-panel collapse (incl. the vendor rail) persist. No free
   pixel-resize — the Partner-detail interaction. */
type PanelKey = "vendors" | "graph" | "transactions";
/** The draggable board holds only these two — vendors is pinned left. */
type DraggableKey = "graph" | "transactions";
type PanelSize = "sm" | "md" | "lg";
const PLANNER_PANEL_DND = "PLANNER_PANEL";
const PLANNER_PANELS_KEY = "po:planner-panels:v4";
const DEFAULT_PANEL_ORDER: DraggableKey[] = ["graph", "transactions"];
const DEFAULT_PANEL_SIZES: Record<PanelKey, PanelSize> = {
  graph: "lg",
  vendors: "md",
  transactions: "lg",
};
/** Default sandbox layout: all three columns (Qualified Vendors · Transaction
    Table · Projected Stock Over Time) expanded side-by-side. The buyer can
    fold any one via its header chevron; the choice persists via
    localStorage. */
const DEFAULT_COLLAPSED: Partial<Record<PanelKey, boolean>> = {};
/* Reset the sandbox to its 3-column default on every fresh page load
   (browser refresh): Vendors · Transactions · Graph all expanded, so the
   buyer sees the full picture at once. Module-level so it fires once per
   load — within a session the buyer's fold choices persist across item
   switches; only a hard refresh re-opens all three. */
let panelFoldResetThisLoad = false;
/** Small / Medium / Large → card width in the flex-wrap row (gap-3 = 12px): a
    third, a half, or the full row. Cards wrap to fill. */
const PANEL_WIDTH: Record<PanelSize, string> = {
  sm: "calc(33.333% - 8px)",
  md: "calc(50% - 6px)",
  lg: "100%",
};
/** Small / Medium / Large → card body height (the graph fills it; the vendor
    list + transaction table scroll inside). */
const PANEL_HEIGHT: Record<PanelSize, number> = { sm: 380, md: 460, lg: 540 };
/** The full-width graph fills the vertical space that's LEFT after the page
    header and the Transaction Table panel, so on tall 2K / 4K screens the graph
    + table fit together in one viewport (instead of a flat 60vh graph that
    pushed the table — controls + rows + paging — below the fold). The ~860px
    reserve ≈ page header (~274) + table panel (540, which fully shows its 7
    rows + controls + paging) + gaps/breathing room. Floor 540 keeps small
    screens unchanged (they scroll, as before); capped for very tall displays.
    Measured fit: 1440px (2K) → graph ~580; 2160px (4K) → graph ~1300. */
const GRAPH_LG_HEIGHT = "clamp(540px, calc(100vh - 860px), 1400px)";

interface PanelLayoutState {
  /** Reorderable draggable panels (vendors is pinned left, never here). */
  order: DraggableKey[];
  sizes: Record<PanelKey, PanelSize>;
  /** Per-panel fold state — includes `vendors` for the left rail. */
  collapsed: Partial<Record<PanelKey, boolean>>;
}
function loadPanelLayout(): PanelLayoutState {
  const fallback: PanelLayoutState = {
    order: [...DEFAULT_PANEL_ORDER],
    sizes: { ...DEFAULT_PANEL_SIZES },
    collapsed: { ...DEFAULT_COLLAPSED },
  };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PLANNER_PANELS_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<PanelLayoutState>;
      const order = Array.isArray(p.order)
        ? p.order.filter((k): k is DraggableKey => (DEFAULT_PANEL_ORDER as readonly string[]).includes(k as string))
        : [];
      return {
        // Only trust a stored order that still covers both draggable panels.
        order: DEFAULT_PANEL_ORDER.every((k) => order.includes(k)) ? order : fallback.order,
        sizes: { ...fallback.sizes, ...(p.sizes ?? {}) },
        collapsed: { ...(p.collapsed ?? {}) },
      };
    }
  } catch {
    /* ignore malformed/disabled storage */
  }
  return fallback;
}

/** One reorderable, resizable sandbox panel (Classic view). Drag its title bar
    to reorder (react-dnd); the Small/Medium/Large toggle sets its width; the
    chevron folds it to the title bar. Matches the Partner-detail card. */
function DraggablePanel({
  index,
  size,
  collapsed,
  title,
  subtitle,
  right,
  onMove,
  onSetSize,
  onToggleCollapsed,
  bodyHeight,
  children,
}: {
  index: number;
  size: PanelSize;
  collapsed: boolean;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onMove: (from: number, to: number) => void;
  onSetSize: (size: PanelSize) => void;
  onToggleCollapsed: () => void;
  /** Override the size-derived body height (e.g. the graph grows with vh). */
  bodyHeight?: number | string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: PLANNER_PANEL_DND,
    item: () => ({ index }),
    collect: (m) => ({ isDragging: m.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop({
    accept: PLANNER_PANEL_DND,
    drop(dragged: { index: number }) {
      if (dragged.index !== index) {
        onMove(dragged.index, index);
        dragged.index = index;
      }
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });
  // Drop target + drag preview = the whole card; drag SOURCE = the header only,
  // so the panel's own content (the interactive graph, the table) stays usable.
  preview(drop(cardRef));
  drag(headerRef);
  return (
    <div
      ref={cardRef}
      style={{
        width: PANEL_WIDTH[size],
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(0.985)" : undefined,
      }}
      className={`transition-[opacity,transform] duration-200 ${
        isOver && !isDragging ? "rounded-xl ring-2 ring-[#0A77FF]/30 ring-offset-2" : ""
      }`}
    >
      <section
        style={collapsed ? undefined : { height: bodyHeight ?? PANEL_HEIGHT[size] }}
        className="group/panel flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <header
          ref={headerRef}
          title="Drag to reorder — use S / M / L to resize"
          className={`flex shrink-0 cursor-grab select-none items-center justify-between gap-3 px-5 py-3 active:cursor-grabbing ${
            collapsed ? "" : "border-b border-slate-100"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronDown
                className="h-4 w-4 transition-transform"
                style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              />
            </button>
            <div className="min-w-0 text-left">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            {/* Size toggle — this IS the "resize". Revealed on panel hover, like
                the Partner-detail cards. */}
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/panel:opacity-100">
              {(["md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSetSize(s)}
                  title={s === "md" ? "Medium" : "Large"}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    size === s ? "bg-white text-[#0A77FF] shadow-sm" : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {s === "md" ? "M" : "L"}
                </button>
              ))}
            </div>
            {right}
          </div>
        </header>
        {!collapsed && <div className="min-h-0 flex-1 overflow-hidden">{children}</div>}
      </section>
    </div>
  );
}

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const VIOLET = "#0A77FF";
/** Horizon windows the buyer can switch between (days). */
const HORIZON_OPTIONS = [30, 60, 90] as const;
const DEFAULT_HORIZON = 30;

/* Planning-surface variations: "Timeline" (the Gantt canvas) and "Classic" (the
   two-column Gap-graph + vendors + transactions layout — the surface we've built
   out). Per product direction the Timeline variation is hidden for every item
   until further notice; the buyer always lands on Classic. Flip this to `true`
   to bring the Timeline back (it then renders for the first planner item). */
const SHOW_TIMELINE_VARIATION: boolean = false;

const SEV_TONE: Record<
  PlannerSeverity,
  { dot: string; bg: string; fg: string; border: string; label: string }
> = {
  healthy: { dot: "#16a34a", bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0", label: "Healthy" },
  below_min: { dot: "#d48e29", bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA", label: "Below min" },
  at_zero: { dot: "#c93248", bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA", label: "At zero" },
  negative: { dot: "#c93248", bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA", label: "Negative" },
};

/* ── Header status pill (Sandbox) ──
   A coarse 3-state classification of the item's CURRENT stock (ATP today)
   against zero and its max level, per product direction. It REPLACES the
   4-band min-severity label on the workspace header pill only — the listing
   bands, the "Issue" tab-grouping tones (SEV_TONE) and the graph's min/max
   threshold lines are all unchanged:
     ATP < 0         → "Negative"  — in the hole / backordered (below zero)
     0 ≤ ATP < max   → "Positive"  — in stock, within range (below-min & below-max)
     ATP ≥ max       → "Overstock" — at/above the maximum level
   "Positive" leans on the graph's min line for the finer below-min nuance, so
   the pill stays a simple where-do-I-stand signal. Overstock reuses the slate
   tone the graph already assigns to the max threshold. */
type StockStatus = "negative" | "positive" | "overstock";

const STATUS_TONE: Record<
  StockStatus,
  { dot: string; bg: string; fg: string; border: string; label: string }
> = {
  /* Listing-vocab labels (Short / Healthy / Overstock) so the sandbox
     status pill reads the same as the listing's stock band chip. */
  negative: { dot: "#c93248", bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA", label: "Short" },
  positive: { dot: "#16a34a", bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0", label: "Healthy" },
  overstock: { dot: "#64748B", bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1", label: "Overstock" },
};

function stockStatusForAtp(atp: number, maxLevel: number): StockStatus {
  if (atp < 0) return "negative";
  if (atp >= maxLevel) return "overstock";
  return "positive";
}

/* ── Tab-grouping (Sandbox) ──
   Open item-tabs group by an intrinsic field (category / vendor / owner).
   Group counts are unbounded, so colours are HASHED from the group key onto a
   fixed palette (the same approach the catalogue uses for avatar tints) rather
   than hard-coded per value. The empty/"Uncategorized" bucket gets a fixed
   neutral slate tone so it never reads as a real coloured group. */
type GroupTone = { dot: string; bg: string; fg: string; border: string };

const GROUP_PALETTE: GroupTone[] = [
  { dot: "#0A77FF", bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" }, // blue
  { dot: "#16A34A", bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0" }, // green
  { dot: "#D97706", bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" }, // amber
  { dot: "#7C3AED", bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE" }, // violet
  { dot: "#0891B2", bg: "#ECFEFF", fg: "#0E7490", border: "#A5F3FC" }, // cyan
  { dot: "#DB2777", bg: "#FDF2F8", fg: "#BE185D", border: "#FBCFE8" }, // pink
  { dot: "#EA580C", bg: "#FFF7ED", fg: "#C2410C", border: "#FED7AA" }, // orange
  { dot: "#0D9488", bg: "#F0FDFA", fg: "#0F766E", border: "#99F6E4" }, // teal
];

const UNCATEGORIZED_TONE: GroupTone = {
  dot: "#94A3B8",
  bg: "#F8FAFC",
  fg: "#475569",
  border: "#E2E8F0",
};

/** Deterministic key → palette colour (stable across reloads). Mirrors the
    catalogue's avatar-tint hash; colour collisions are acceptable. */
function groupTone(key: string): GroupTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length];
}

const GROUP_BY_LABEL: Record<PlannerGroupBy, string> = {
  category: "Category",
  owner: "Owner",
  severity: "Issue",
  none: "None",
};

/** Fallback bucket key for an empty field value, per dimension. (Severity is
    excluded — it keys off the projected band, never an empty field.) */
const GROUP_FALLBACK: Record<"category" | "owner", string> = {
  category: "Uncategorized",
  owner: "Unassigned",
};
const FALLBACK_KEYS = new Set<string>(Object.values(GROUP_FALLBACK));

/** Bucket key for an item under the active grouping dimension. For "severity"
    the key is the item's projected band (resolved via `sevOf`, since the band
    isn't a field on the item). */
function groupKeyFor(
  item: PlannerItem,
  by: PlannerGroupBy,
  sevOf?: (code: string) => PlannerSeverity,
): string {
  switch (by) {
    case "category":
      return item.category || GROUP_FALLBACK.category;
    case "owner":
      return item.purchasingOwner || GROUP_FALLBACK.owner;
    case "severity":
      return sevOf ? sevOf(item.itemCode) : "healthy";
    default:
      return "";
  }
}

type TabGroup = { key: string; label: string; tone: GroupTone; items: PlannerItem[] };

/** Once at least this many tabs are open the strip gets crowded, so inactive
    tabs collapse to thumbnail-only (item code hidden, browser-favicon style); the
    active tab always keeps its name. Tunable. */
/* Estimated pixel width for one uncompacted tab (thumbnail + code + name +
   close button + gaps). Used to decide whether the current set of tabs
   would overflow the tab-strip container. Slightly generous so we don't
   flip-flop between compact/full at the boundary. */
const UNCOMPACTED_TAB_WIDTH = 180;
/* Compact (icon-only) tab width — favicon (24) + gutters + close (14).
   Used by the progressive-compaction math below so we can accurately
   estimate how many named tabs fit alongside a run of compact ones. */
const COMPACT_TAB_WIDTH = 42;

/* Auto-supply mode config for the graph's Auto dropdown.
   ─────────────────────────────────────────────────────
   The Auto dropdown offers TWO modes (Eli's fullest spec, 2026-07-19):
     Mode 1 · Follow item-master rules  (default)
       → whatever poRecommendationRule is set on this item's card.
     Mode 2 · Override with custom rules
       → buyer picks trigger + refill directly.
   The item's own rule maps to a concrete `RecommendationConfig` via
   ITEM_RULE_TO_CONFIG below. */
const ITEM_RULE_TO_CONFIG: Record<PORecommendationRule, RecommendationConfig> = {
  min: { source: "item-master", trigger: "min", fillTo: "max" },
  zero: { source: "item-master", trigger: "zero", fillTo: "max" },
  disable: { source: "item-master", trigger: "off", fillTo: "min" },
};

/* Custom-rule TRIGGER options — full 3×3 matrix per buyer 2026-07-22.
   "Below max" is back (top-off rule for critical items); the refill
   constraint below narrows the coherent refill target for each trigger. */
const CUSTOM_TRIGGER_OPTIONS: Array<{
  value: Exclude<RecommendationTrigger, "off">;
  label: string;
  hint: string;
}> = [
  { value: "zero", label: "Below zero", hint: "Fires only when stock is projected to go negative." },
  { value: "min", label: "Below minimum", hint: "Fires when projected stock falls to or below the item's minimum." },
  { value: "max", label: "Below max", hint: "Top off — fires the moment projected stock dips below the item's max." },
];

/* Custom-rule FILL options. Buyer 2026-07-19: trigger and refill must
   be constrained to each other — refilling BELOW the trigger yields an
   incoherent rule ("refill to zero" when triggered "below min" would
   still leave you short). `fillOptionsFor(trigger)` returns only the
   coherent choices; the UI hides the rest. */
const CUSTOM_FILL_OPTIONS: Array<{
  value: RecommendationFillTo;
  label: string;
  hint: string;
}> = [
  { value: "zero", label: "Zero", hint: "Just close the shortfall." },
  { value: "min", label: "Minimum", hint: "Bring stock back up to the item's minimum level." },
  { value: "max", label: "Maximum", hint: "Bulk-buy up to the item's maximum — amortize the PO admin cost." },
];

/** Coherent refill targets for a given trigger — the refill must land
    AT OR ABOVE the trigger, otherwise the rule can't self-satisfy.
      trigger `zero` → refill zero / min / max
      trigger `min`  → refill min / max     (not zero)
      trigger `max`  → refill max only      (not surfaced today; here
        for completeness in case "below max" is re-introduced later). */
function fillOptionsFor(
  trigger: RecommendationTrigger,
): RecommendationFillTo[] {
  if (trigger === "zero") return ["zero", "min", "max"];
  if (trigger === "min") return ["min", "max"];
  if (trigger === "max") return ["max"];
  return ["zero", "min", "max"];
}

/** Snap an incoming fillTo to the closest valid choice for the given
    trigger (used when the trigger changes and the previously-selected
    fillTo is no longer coherent). Preserves buyer intent: if they had
    "max", keep "max"; if invalid, fall back to the trigger's minimum
    coherent choice. */
function coerceFillTo(
  trigger: RecommendationTrigger,
  desired: RecommendationFillTo,
): RecommendationFillTo {
  const valid = fillOptionsFor(trigger);
  if (valid.includes(desired)) return desired;
  return valid[0];
}

const TRIGGER_LABEL: Record<RecommendationTrigger, string> = {
  off: "Off",
  zero: "Below zero",
  min: "Min threshold",
  max: "Below max",
};
const FILL_LABEL: Record<RecommendationFillTo, string> = {
  zero: "Zero",
  min: "Min",
  max: "Max",
};

/** One radio-style row inside the Auto dropdown — full-width click
    target with a leading radio, a bold title, and a short subtitle.
    Children (if any) render below the row when it's selected so a
    row can carry its own inline settings (used for the "Custom rule"
    row's trigger + fill chips). Mirrors the item-library "PO
    Recommendation Rules" pattern buyer shared 2026-07-14. */
function RecoOptionRow({
  selected,
  onSelect,
  title,
  subtitle,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`mx-1.5 mb-1 rounded-lg border transition-colors ${
        selected
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left"
      >
        <span
          className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected ? "border-emerald-600" : "border-slate-300"
          }`}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-slate-800">{title}</span>
          <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-500">
            {subtitle}
          </span>
        </span>
      </button>
      {children && selected && <div className="px-2.5 pb-2.5">{children}</div>}
    </div>
  );
}

/** One item-tab — thumbnail (hover to preview) + code + close. In a group it
    takes `groupTone`, which paints the Chrome group line: ABOVE the active tab
    (raised, tinted, rounded-top) and BELOW the inactive ones (an underline);
    without it (the flat strip) it falls back to the plain blue active underline.
    When `compact` the strip is crowded, so INACTIVE tabs drop the code and show
    the thumbnail alone — favicon-style — while the active tab keeps its name. */
function TabChip({
  item,
  active,
  onSelect,
  onClose,
  groupTone,
  compact,
}: {
  item: PlannerItem;
  active: boolean;
  onSelect: (code: string) => void;
  onClose: (code: string) => void;
  groupTone?: GroupTone;
  compact?: boolean;
}) {
  const showName = !compact || active;
  return (
    <div
      className={`group flex shrink-0 cursor-pointer items-center py-1 text-[12.5px] transition-colors 2xl:py-2 2xl:text-sm ${
        showName ? "gap-1.5 px-1.5 2xl:gap-2 2xl:px-2.5" : "px-1 2xl:px-1.5"
      } ${
        groupTone
          ? active
            ? "planner-tab-foot rounded-t-md border-x-[3px] border-t-[3px] font-semibold text-slate-900"
            : "border-b-[3px] text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          : active
            ? "border-b-2 border-[#0A77FF] font-semibold text-slate-900"
            : "border-b-2 border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      }`}
      style={
        groupTone
          ? active
            ? ({
                backgroundColor: groupTone.bg,
                borderColor: groupTone.dot,
                "--tab-fill": groupTone.bg,
                "--tab-line": groupTone.dot,
              } as CSSProperties)
            : { borderBottomColor: groupTone.dot }
          : undefined
      }
      onClick={() => onSelect(item.itemCode)}
      title={showName ? undefined : item.itemCode}
    >
      <HoverCard openDelay={150} closeDelay={60}>
        <HoverCardTrigger asChild>
          <span
            className={`h-5 w-5 shrink-0 overflow-hidden rounded-md border bg-slate-50 2xl:h-6 2xl:w-6 ${
              active ? "border-[#0A77FF]/40" : "border-slate-200"
            }`}
          >
            <ImageWithFallback
              src={item.itemImage}
              alt={item.itemName}
              className="h-full w-full object-cover"
            />
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="start" className="w-64 overflow-hidden p-0">
          <div className="h-36 w-full bg-slate-50">
            <ImageWithFallback
              src={item.itemImage}
              alt={item.itemName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-3">
            <div className="text-[13px] font-semibold text-slate-900">{item.itemCode}</div>
            <div className="text-xs text-slate-600">{item.itemName}</div>
            {item.description && (
              <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                {item.description}
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
      {showName && <span className="truncate">{item.itemCode}</span>}
      {showName && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(item.itemCode);
          }}
          className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
          aria-label={`Close ${item.itemCode}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Coloured group label — a small FLOATING tag (Chrome tab-group style): the
    group name in the group tone as a rounded filled pill (tone.bg + 1px
    tone.border + tone.fg text + subtle shadow) that floats vertically centred and
    set slightly apart from the tabs (it does NOT sit on the tabs' baseline line).
    Static — no count, no collapse. */
function GroupHeaderChip({ group }: { group: TabGroup }) {
  const { tone } = group;
  return (
    <div
      className="flex shrink-0 items-center self-center rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm"
      style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
    >
      <span className="max-w-[160px] truncate">{group.label}</span>
    </div>
  );
}

/** "Group by" dimension switcher — mirrors the in-file horizon-picker Popover
    idiom (styled button trigger + lightweight option list). */
function GroupByControl({ groupBy }: { groupBy: PlannerGroupBy }) {
  const [open, setOpen] = useState(false);
  const options: PlannerGroupBy[] = ["category", "owner", "severity", "none"];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex shrink-0 items-center gap-1 self-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 data-[state=open]:border-[#0A77FF]/40 data-[state=open]:bg-[#0A77FF]/[0.04] data-[state=open]:text-[#0A77FF] 2xl:gap-1.5 2xl:px-2 2xl:py-1 2xl:text-[11px]"
        >
          <Layers className="h-3 w-3 text-slate-400 transition-colors group-hover:text-slate-500 group-data-[state=open]:text-[#0A77FF] 2xl:h-3.5 2xl:w-3.5" />
          <span className="text-slate-400">Group:</span>
          <span className="font-semibold text-slate-700 group-data-[state=open]:text-[#0A77FF]">
            {GROUP_BY_LABEL[groupBy]}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-400 transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-44 p-1">
        {options.map((opt) => {
          const selected = opt === groupBy;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setPlannerGroupBy(opt);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[13px] hover:bg-slate-50"
              style={{
                fontWeight: selected ? 600 : 500,
                color: selected ? "#0A77FF" : "#475569",
              }}
            >
              {GROUP_BY_LABEL[opt]}
              {selected && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Whole days from today for an ISO date (negative = past). */
function daysFromToday(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
}

/** ISO date `day` days from today (inverse of daysFromToday). */
function isoFromDay(day: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + day);
  // Local Y/M/D — toISOString() would convert to UTC and land a day early for
  // timezones ahead of UTC, so a plotted PO's curve bump / table row fell one
  // day before its (day-based) marker.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Stable id for an incoming supply event — must match the key the
    projection / transaction stream use so overrides line up. */
const incomingId = (inc: FutureIncomingEvent): string =>
  `incoming-${inc.poNumber}-${inc.expectedDate}-${inc.qty}`;

/** Simulated-entry id prefixes by type — a simulated sales order reads
    "SO-SIM-001", a receiving "PO-SIM-001", etc. Replaces the manual Reference
    field: the chosen type now implies the document id, no naming required. */
const SIM_ID_PREFIX: Record<string, string> = {
  SO: "SO",
  "Purchase Request": "PR",
  "Planned demand": "PLN",
  PO: "PO",
};

/** Human label for a simulated what-if dot, by type — so a graph what-if
    reads "Sales order" / "PO" rather than a generic "Predicted". Kept in
    sync with the transaction table's source-doc terminology (2026-07-10
    fix: this table is a FUTURE projection, so "Receiving" was wrong — it
    implies a past event). */
const SIM_TYPE_LABEL: Record<string, string> = {
  SO: "Sales order",
  "Purchase Request": "User request",
  "Planned demand": "Planned demand",
  PO: "PO",
};

/** Cart-item id prefix for planner-parked POs — lets the cart distinguish
    planner plans from catalogue orders (matches the legacy sandbox scheme). */
const SANDBOX_CART_PREFIX = "planner-sandbox::";

/** How many planner-parked POs sit in the cart right now (across all the
    items planned this session) — drives the top-bar cart indicator. */
const countPlannedInCart = (): number =>
  getCart().filter((c) => c.catalogItem.id.startsWith(SANDBOX_CART_PREFIX)).length;

/** A predicted "what-if" transaction the buyer mocks onto the Timeline — not a
    real SO or PO. Demand pulls ATP down, supply lifts it; both fold into the
    projection so the coverage ribbon reacts, but nothing is ever persisted. */
interface MockTxn {
  id: string;
  kind: "demand" | "supply";
  qty: number;
  /** Day offset from today (0 = today), clamped to the horizon. */
  day: number;
  label: string;
  excluded?: boolean;
}

/** Decision trace attached to each auto-generated PO, capturing WHY
    the auto engine plotted this chunk. Exposed in the AutoBreakdownDialog
    as a click-to-reveal so the buyer can see the Step-1 gate at a glance:
    "which vendors could satisfy the need, and why did this one win?"

    Eli 2026-07-31: "Step 1 — can a vendor solve this? If yes, one → plot.
    If yes, more than one → highest priority. If no → user manually
    resolves." Two more cases the buyer flagged: qty-fit (single vendor
    covers the whole need) vs split (multiple vendors chunk it). Populated
    only on auto POs — manual POs leave this undefined. */
interface AutoDecision {
  /** The event's shortfall qty (pre-snapping to multiples). */
  neededQty: number;
  /** Day the shortfall lands — the ideal arrival date. */
  shortfallDay: number;
  /** Snapshot of every qualified vendor considered for this event, in
      the same ranked order the engine walked. Rendered in the reveal so
      the buyer sees who was in the running. */
  candidates: Array<{
    vendorId: string;
    vendorName: string;
    rank: number;
    leadTimeDays: number;
    maxOrderQty: number;
    canArriveOnTime: boolean;
    canFulfilAlone: boolean;
  }>;
  /** Which of the four Step-1 branches produced this chunk:
        · single-solve             — one vendor could cover it alone; taken
        · highest-priority-of-many — multiple could solve alone; top rank won
        · split-across-vendors     — no single vendor could cover qty; chunked
        · late-fallback            — no vendor arrives on time; best-available */
  outcome:
    | "single-solve"
    | "highest-priority-of-many"
    | "split-across-vendors"
    | "late-fallback";
  /** Position of this chunk within the event's split (0-based). Always
      0 when outcome !== "split-across-vendors". */
  chunkIndex: number;
  /** Total chunks the event was split into. Always 1 when not split. */
  chunkCount: number;
}

/** A purchase order the buyer has composed in the Fulfillment graph. */
interface ProposedPO {
  /** Unique PO id. `v-<vendorId>` for the per-vendor primary allocation;
      the extra-PO id (`xpo-<n>`) for additional POs added on the Timeline. */
  id: string;
  vendorId: string;
  vendorName: string;
  qty: number;
  leadTimeDays: number;
  /** Day the goods land (order day + lead time); draggable on the gap graph. */
  arrivalDay: number;
  /** Day the order is placed = arrivalDay − leadTime (clamped ≥ 0). The graph
      marks this as the non-lifting "Planned PO" point. */
  orderDay: number;
  unitPrice: number;
  pricingRules: PlannerVendor["pricingRules"];
  /** Day the auto-recommender wanted this PO to LAND — i.e. the shortfall
      day the PO is covering. If `arrivalDay > shortfallDay`, the vendor's
      lead time couldn't meet the shortfall and the row is late.
      Undefined for manual POs (the buyer chose the arrival directly). */
  shortfallDay?: number;
  /** Step-1 gate trace — auto POs only. See AutoDecision above. */
  autoDecision?: AutoDecision;
}

/** An additional PO the buyer adds to a vendor's lane on the Timeline (beyond
    the primary allocation) — lets one vendor's order be split across dates.
    Timeline-only; the Classic Fulfillment graph keeps its one-lane-per-vendor
    model untouched. */
interface ExtraPO {
  id: string;
  vendorId: string;
  qty: number;
  /** Planned arrival day (clamped to ≥ lead time, ≤ horizon on read). */
  arrivalDay: number;
}

/* ─────────────────────────── SECTION SHELL ─────────────────────────── */

function SectionCard({
  title,
  subtitle,
  right,
  children,
  collapsible = false,
  defaultCollapsed = false,
  open: openProp,
  onToggleOpen,
  fill = false,
  dragHandle = false,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  /** When true, the header shows a chevron that toggles the body (accordion). */
  collapsible?: boolean;
  /** Start collapsed (only meaningful when `collapsible` + uncontrolled). */
  defaultCollapsed?: boolean;
  /** Controlled open state. The free-sandbox grid drives this so a panel's
      collapse persists and shrinks its grid cell; omit for self-managed cards. */
  open?: boolean;
  /** Called when the chevron is clicked (controlled mode). */
  onToggleOpen?: () => void;
  /** Stretch the card to fill its grid cell (flex column) so the body can
      own its own height — used by the Classic left column so it tracks the
      adjacent graph + transactions column. */
  fill?: boolean;
  /** Turn the whole header into the free-sandbox drag zone (`.planner-drag-zone`)
      so the panel can be repositioned by grabbing its title bar. */
  dragHandle?: boolean;
}) {
  const [openInternal, setOpenInternal] = useState(!(collapsible && defaultCollapsed));
  const open = openProp !== undefined ? openProp : openInternal;
  const toggle = onToggleOpen ?? (() => setOpenInternal((v) => !v));

  const titleCluster = (
    <div className="min-w-0 text-left">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${
        fill ? "flex h-full flex-col" : ""
      }`}
    >
      <header
        className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
          open ? "border-b border-slate-100" : ""
        } ${fill ? "shrink-0" : ""} ${
          dragHandle ? "planner-drag-zone cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {collapsible && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
              className="planner-no-drag group -ml-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronDown
                className="h-4 w-4 transition-transform"
                style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
              />
            </button>
          )}
          {titleCluster}
        </div>
        {(!collapsible || open) && right && (
          <div className="planner-no-drag flex shrink-0 items-center">{right}</div>
        )}
      </header>
      <div className={`p-5 ${open ? "" : "hidden"} ${fill ? "min-h-0 flex-1" : ""}`}>
        {children}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function PlannerWorkspacePage() {
  const { itemCode } = useParams<{ itemCode: string }>();
  const navigate = useNavigate();
  const openItems = useOpenPlannerItems();
  const sandboxVariant = useSandboxVariant();

  /* V2 snap-scroll — each row (graph, vendors+transactions) occupies one
     full viewport worth of height. The outer container uses CSS scroll-
     snap so the buyer either sees the graph or the panels, never a
     compressed hybrid. A floating indicator on the right edge tells the
     buyer to scroll for the other row and jumps there on click. */
  const v2ScrollRef = useRef<HTMLDivElement | null>(null);
  const [v2Section, setV2Section] = useState<"graph" | "panels">("graph");
  useEffect(() => {
    const el = v2ScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      /* Threshold: once the container has scrolled past ~40% of its
         client height, we consider the buyer to be looking at Row 2. */
      const threshold = el.clientHeight * 0.4;
      setV2Section(el.scrollTop > threshold ? "panels" : "graph");
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [sandboxVariant]);
  const scrollV2To = useCallback((section: "graph" | "panels") => {
    const el = v2ScrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: section === "graph" ? 0 : el.clientHeight,
      behavior: "smooth",
    });
  }, []);

  /* Width-driven tab compaction (Rida A3). ResizeObserver watches the tab-
     strip container; when the current tabs would overflow the available
     width, the strip flips into compact mode (code-only chips). Replaces
     the old hard-coded `tabs.length >= 7` heuristic that fired even when
     the strip had room. */
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const [tabStripWidth, setTabStripWidth] = useState(0);
  useEffect(() => {
    const el = tabStripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setTabStripWidth(w);
    });
    ro.observe(el);
    setTabStripWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* Transactions ↔ Graph resize floor (buyer 2026-07-21). Both sides
     have a px floor so neither can shrink the other into uselessness:

       · TX_MIN_PX    — table content 578 + chrome ≈ 690 (buyer
         2026-07-23 further tightened the column widths)
       · GRAPH_MIN_PX — the graph is unreadable below ~500px (X-axis
         ticks pile up, event dots collapse into a mess).

     When the row is too narrow to hold BOTH mins simultaneously, the
     graph now wins (buyer 2026-07-21 revision: "graph is shrinking too
     much"). Tx overflows horizontally instead — its underlying table
     already supports horizontal scroll for that case. */
  /* Split floors + default share — Eli 2026-07-30: "graph gets more
     horizontal room, especially over 60-90 day periods". Target default
     is 70/30 in favor of the graph (was ~58/42). Tx floor shrinks so
     the compressed column defaults can sit inside a tighter panel. */
  const TX_MIN_PX = 300;
  const GRAPH_MIN_PX = 700;
  const DEFAULT_GRAPH_PCT = 70;
  const txGraphRowRef = useRef<HTMLDivElement | null>(null);
  const txGraphGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const txPanelRef = useRef<ImperativePanelHandle | null>(null);
  const graphPanelRef = useRef<ImperativePanelHandle | null>(null);
  const [txGraphRowWidth, setTxGraphRowWidth] = useState(0);
  /* Live minimum-content width of the transaction table, in pixels.
     Reported by PlannerTransactionTable whenever visible columns
     change. Drives dynamic tx-panel shrinking (Eli 2026-07-30). */
  const [txTableMinPx, setTxTableMinPx] = useState<number>(TX_MIN_PX);
  const handleTxMinWidthChange = useCallback((minPx: number) => {
    // Small buffer (16px) for cell padding + potential scrollbar.
    setTxTableMinPx(minPx + 16);
  }, []);
  useEffect(() => {
    const el = txGraphRowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setTxGraphRowWidth(w);
    });
    ro.observe(el);
    setTxGraphRowWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  /* Convert both px floors into % of the group container. No lower
     clamp on graph so it can shrink to exactly its ~500px minimum on
     very wide viewports (a 15% hard floor keeps it visible on absurd
     ultra-wide setups). Initial pre-measure assumes ~1200px desktop
     row so first-render lands close and gets corrected once the real
     width lands. */
  const { txMinPct, txAutoTargetPct, graphMinPct } = useMemo(() => {
    const w = txGraphRowWidth > 0 ? txGraphRowWidth : 1200;
    const graphRaw = (GRAPH_MIN_PX / w) * 100;
    // Graph floor stays generous so the curve stays legible on wide
    // screens; ceiling clamps so tx never disappears entirely.
    let graph = Math.min(85, Math.max(50, graphRaw));
    // Tx floor is the LIVE column-sum % (Eli 2026-07-30 revision:
    // "columns need to be viewable"). Restoring the dynamic floor
    // means on smaller screens the panel widens just enough to
    // keep every visible column at its natural width; on wide
    // screens the column-sum drops below 30% so the target below
    // takes over and the graph gets the majority.
    const rawTxPctForCols = (txTableMinPx / w) * 100;
    const tx = Math.min(45, Math.max(10, rawTxPctForCols));
    // Auto-target: use 30% by default (Eli's design target) but
    // never below the column-sum floor. On smaller screens where
    // the columns already need more than 30%, the floor wins so
    // the table stays readable.
    const target = Math.max(tx, Math.min(30, 100 - graph));
    return { txMinPct: tx, txAutoTargetPct: target, graphMinPct: graph };
  }, [txGraphRowWidth, txTableMinPx]);
  /* Track buyer drag intent — once they've moved the divider we stop
     re-snapping the layout on window resizes so their preferred split
     survives. Cleared only when the user reloads. */
  const buyerDraggedRef = useRef(false);
  /* Force the layout to [tx = 100 - graphMin, graph = graphMin] every
     time the row width or graph floor changes. Uses the group's
     imperative handle rather than fighting defaultSize + minSize prop
     changes (which react-resizable-panels doesn't reliably enforce
     after mount). If the buyer has deliberately dragged the divider
     we skip so their choice isn't wiped. */
  /* Auto-size the tx panel to fit the current visible columns
     (Eli 2026-07-30). The panel tightens whenever a column is
     hidden and grows just enough when one is re-shown. Skipped
     once the buyer has manually dragged the divider so their
     preferred split survives. Target is capped at 30% so the
     graph gets the majority of horizontal room even on smaller
     screens where the column sum otherwise dominates. */
  useEffect(() => {
    if (txGraphRowWidth <= 0) return;
    if (buyerDraggedRef.current) return;
    const raf = requestAnimationFrame(() => {
      const group = txGraphGroupRef.current;
      if (!group) return;
      group.setLayout([txAutoTargetPct, 100 - txAutoTargetPct]);
    });
    return () => cancelAnimationFrame(raf);
  }, [txAutoTargetPct, txGraphRowWidth]);

  /* Live PO store — drives "future incoming" supply. */
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData[]>(
    () => getAllPOs(),
  );
  useEffect(() => {
    setPurchaseOrders(getAllPOs());
    return subscribeToPOStore(() => setPurchaseOrders(getAllPOs()));
  }, []);

  /* Planner POs parked in the cart — live count for the top-bar indicator
     (accumulates across every item planned this session). */
  const [plannedInCart, setPlannedInCart] = useState<number>(() =>
    countPlannedInCart(),
  );
  useEffect(() => {
    setPlannedInCart(countPlannedInCart());
    return subscribeToCart(() => setPlannedInCart(countPlannedInCart()));
  }, []);

  /* Register the routed item as an open tab (only if it's a real item)
     and stamp it as the last-active item so the listing can surface a
     one-click "Continue with <item>" jump-back. */
  useEffect(() => {
    if (itemCode && PLANNER_ITEMS.some((i) => i.itemCode === itemCode)) {
      openPlannerItem(itemCode);
      setLastActiveItem(itemCode);
    }
  }, [itemCode]);

  const activeCode = itemCode ?? null;
  const item: PlannerItem | undefined = useMemo(
    () => PLANNER_ITEMS.find((i) => i.itemCode === activeCode),
    [activeCode],
  );

  /* ── What-if overrides ──
     Keyed by event id: `dayOffset` = rescheduled day (drag), `excluded`
     = dropped from the calculation (toggle). Reset when the active item
     changes so each tab starts from reality. */
  const [overrides, setOverrides] = useState<
    Map<string, { dayOffset?: number; excluded?: boolean }>
  >(() => new Map());
  const [horizonDays, setHorizonDays] = useState<number>(DEFAULT_HORIZON);
  /* Full-view toggle — mirrors the PO detail page (PurchaseOrderDraft):
     the body's max-w-[1520px] constraint drops to max-w-none so the
     Full-width layout is now permanent — the compact/full toggle was
     removed 2026-07-22 per buyer feedback. */
  /* Predicted "what-if" transactions the buyer mocks onto the Timeline. Local
     to the session, reset per item — never persisted. */
  const [mockEvents, setMockEvents] = useState<MockTxn[]>([]);
  /* Day offset (0 = today) under the cursor on the gap graph, or null. Bridges
     the graph's hover to the Transaction Table so matching rows highlight in
     their event colour. */
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  /* Custom-horizon range picker. `horizonStartDay` is the visible window's
     left edge (day offset from today; 0 = today); `horizonDays` is the right
     edge. The projection still always runs from today — start only pans the
     graph's visible window. `pendingRange` holds the in-progress calendar
     selection while the popover is open. */
  const [horizonStartDay, setHorizonStartDay] = useState<number>(0);
  const [horizonPickerOpen, setHorizonPickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  /* Free-form sandbox layout (Classic view) — Partner-detail-style. Panel ORDER
     (drag a title bar to reorder), per-panel SIZE (Small / Medium / Large
     width), and per-panel COLLAPSE (fold to the title bar). All persisted so
     the arrangement survives reloads. */
  const [panelLayout, setPanelLayout] = useState<PanelLayoutState>(() => {
    const base = loadPanelLayout();
    const isFirstMountThisLoad = !panelFoldResetThisLoad;
    panelFoldResetThisLoad = true;
    /* First-time (default): on the first mount of a fresh page load, force
       the 3-column default (all columns expanded) regardless of what was
       persisted, and re-persist it so remounts this load agree. Panel order
       + sizes stay as the buyer last arranged them. Recurring (dev) mode
       restores the persisted layout as-is. */
    if (getPlannerUserMode() !== "recurring" && isFirstMountThisLoad) {
      /* Small-screen default (<2xl / 14" MBP and below): fold the Qualified
         Vendors panel to its rail so the Transaction Table + Projected Stock
         graph get the width they need. Buyers can pop it open via the rail
         and the choice persists for the session. 2xl+ keeps the three-column
         default. Feature-detect against `matchMedia` when available so SSR
         / non-DOM environments never crash. */
      const smallScreen =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function"
          ? window.matchMedia("(max-width: 1535px)").matches
          : false;
      const defaultCollapsed = smallScreen
        ? { ...DEFAULT_COLLAPSED, vendors: true }
        : { ...DEFAULT_COLLAPSED };
      const fresh: PanelLayoutState = { ...base, collapsed: defaultCollapsed };
      try {
        localStorage.setItem(PLANNER_PANELS_KEY, JSON.stringify(fresh));
      } catch {
        /* ignore quota / disabled storage */
      }
      return fresh;
    }
    return base;
  });
  const persistPanelLayout = (next: PanelLayoutState) => {
    setPanelLayout(next);
    try {
      localStorage.setItem(PLANNER_PANELS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / disabled storage */
    }
  };
  const movePanel = (from: number, to: number) => {
    if (from === to) return;
    const order = [...panelLayout.order];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    persistPanelLayout({ ...panelLayout, order });
  };
  const setPanelSize = (key: PanelKey, size: PanelSize) =>
    persistPanelLayout({ ...panelLayout, sizes: { ...panelLayout.sizes, [key]: size } });
  const togglePanelCollapsed = (key: PanelKey) =>
    persistPanelLayout({
      ...panelLayout,
      collapsed: { ...panelLayout.collapsed, [key]: !panelLayout.collapsed[key] },
    });
  const resetPanelLayout = () =>
    persistPanelLayout({
      order: [...DEFAULT_PANEL_ORDER],
      sizes: { ...DEFAULT_PANEL_SIZES },
      collapsed: { ...DEFAULT_COLLAPSED },
    });
  const mockSeq = useRef(0);
  /* Additional POs per vendor, added from the Timeline (beyond each vendor's
     primary allocation). Reset per item. */
  const [extraPOs, setExtraPOs] = useState<ExtraPO[]>([]);
  const extraSeq = useRef(0);
  /* Buyer 2026-07-29 — allow editing individual auto-generated POs
     without turning off Auto mode wholesale. When the buyer clicks
     the pencil on an auto-proposed row, its `auto-<vendorId>-<day>-
     <idx>-<subIdx>` id lands here so the autoProposedPOs generator
     skips re-emitting that entry, and a matching manual ExtraPO is
     materialized so the existing edit machinery (`editingExtraPOId`,
     wizard prefill, plotVendorAt replace-in-place) drives the tweak.
     The set persists until Auto is toggled off (which clears
     extraPOs' auto-derived entries anyway) or the buyer removes the
     materialized manual entry. */
  const [materializedAutoIds, setMaterializedAutoIds] = useState<Set<string>>(new Set());
  /* Auto POs the buyer explicitly deleted via the graph. Without this
     the delete click on an `auto-*` dot was a silent no-op — the
     generator regenerated the entry on next render. Set is cleared
     when Auto is toggled off (via clearProposedPOs). Buyer
     2026-07-30: "delete is not working on a plotted auto item". */
  const [suppressedAutoIds, setSuppressedAutoIds] = useState<Set<string>>(new Set());
  /* Simulated what-if transactions added from the Transaction Table header.
     Scratch + per-item; they move the table's running Gap only (not the
     gap-graph curve). */
  const [simulatedTxns, setSimulatedTxns] = useState<SimulatedTxn[]>([]);
  const simSeq = useRef(0);
  /* Draft-PO visibility — single source of truth across the graph,
     projection curve, and transaction table (Eli 2026-07-16: "the two
     filter states aren't synced — draft shows in the event timeline
     (on) but not the table (off). If draft is on it must move the
     graph and table"). Default OFF so a not-yet-sent draft doesn't
     inflate coverage by default; buyers who want to see drafts flip
     this toggle from the transaction table's pill. */
  const [showDrafts, setShowDrafts] = useState<boolean>(false);
  /* Fulfillment-graph state: which vendors are on the graph + how much is
     allocated to each. Reset (and the primary re-selected) on item change. */
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [allocations, setAllocations] = useState<Map<string, number>>(
    () => new Map(),
  );
  /** Planned arrival day per proposed PO (vendorId → day). Default = lead
      time; the gap-graph drag updates it. */
  const [proposedArrival, setProposedArrival] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  /* Click-to-plan modal (opened from the Gap Graph). */
  /* Manual need-by + order-by days (offset from today). null = use the
     auto-defaults. The two are INDEPENDENT — each is dragged/edited on its own
     gap-graph line and stored separately; moving one never moves the other.
     Reset clears each back to its auto. Per item. */
  const [needByOverride, setNeedByOverride] = useState<number | null>(null);
  const [orderByOverride, setOrderByOverride] = useState<number | null>(null);
  useEffect(() => {
    setOverrides(new Map());
    setProposedArrival(new Map());
    setConfirmOpen(false);
    setMockEvents([]);
    setExtraPOs([]);
    setSimulatedTxns([]);
    setNeedByOverride(null);
    setOrderByOverride(null);
    simSeq.current = 0;
    /* No pre-fill — the buyer allocates from the "Qualified vendors" panel.
       It dropped its select step, so a vendor enters the plan only when its qty
       stepper goes above zero (selectedVendorIds then follows via setAllocation).
       Nothing is pre-selected or pre-allocated on item change. */
    setSelectedVendorIds(new Set());
    setAllocations(new Map());
  }, [activeCode]);

  /** All vendors available for this item (contracted + shared pool). */
  const expandedVendors = useMemo(
    () => (item ? expandVendorsForItem(item) : []),
    [item],
  );
  /** The full marketplace — qualified vendors PLUS the non-qualified pool. Used
      by the gap graph's "Show all vendors" path (buying outside the qualified
      list) and as the lookup superset when plotting one of those vendors. */
  const expandedAllVendors = useMemo(
    () => (item ? expandAllVendorsForItem(item) : []),
    [item],
  );

  /* Tab order = session store, guaranteeing the active item is present
     (it gets added by the effect, but include it eagerly so the tab
     paints on the first render too). */
  const tabs = useMemo<PlannerItem[]>(() => {
    const codes = openItems.slice();
    if (activeCode && !codes.includes(activeCode)) codes.push(activeCode);
    return codes
      .map((c) => PLANNER_ITEMS.find((i) => i.itemCode === c))
      .filter((i): i is PlannerItem => !!i);
  }, [openItems, activeCode]);

  /* Progressive compaction — how many tabs (from the start of the strip)
     should still show their code label. Tabs at index >= `namedTabCount`
     collapse to favicon-only. Active tab always shows its label (that
     override lives in TabChip itself).
     Math: if all N tabs at UNCOMPACTED_TAB_WIDTH fit, everyone named.
     Otherwise the widest run that still fits is:
       k · FULL + (N − k) · COMPACT ≤ stripWidth
       k ≤ (stripWidth − N · COMPACT) / (FULL − COMPACT)
     Falls back to 0 (all compact) when the strip is very narrow. */
  const namedTabCount = (() => {
    if (tabStripWidth <= 0) return tabs.length; // pre-measure: everyone named
    if (tabs.length * UNCOMPACTED_TAB_WIDTH <= tabStripWidth) return tabs.length;
    const numerator = tabStripWidth - tabs.length * COMPACT_TAB_WIDTH;
    const denom = UNCOMPACTED_TAB_WIDTH - COMPACT_TAB_WIDTH;
    return Math.max(0, Math.floor(numerator / denom));
  })();

  /* ── Tab grouping ── a pure view transform over `tabs`; `null` ⇒ flat strip.
     Lives below `tabs` and the projection inputs (`purchaseOrders`/`horizonDays`),
     since the "severity" dimension projects each open item's band. */
  const groupBy = usePlannerGroupBy();
  /* Per-open-item projected band — only computed when grouping by severity, so
     we don't pay N projections otherwise. Uses each item's BASE demand/incoming
     (no sims/proposals), matching how the listing classifies items. */
  const severityByCode = useMemo<Map<string, PlannerSeverity>>(() => {
    const m = new Map<string, PlannerSeverity>();
    if (groupBy !== "severity") return m;
    for (const t of tabs) {
      const curve = projectAtpCurve(
        t,
        getDemandEventsForItem(t),
        getFutureIncomingForItem(t.itemCode, purchaseOrders),
        horizonDays,
      );
      m.set(t.itemCode, worstSeverityInHorizon(curve, t.minLevel));
    }
    return m;
  }, [tabs, groupBy, purchaseOrders, horizonDays]);
  const tabGroups = useMemo<TabGroup[] | null>(() => {
    if (groupBy === "none") return null;
    const sevOf = (code: string): PlannerSeverity =>
      severityByCode.get(code) ?? "healthy";
    const order: string[] = [];
    const byKey = new Map<string, PlannerItem[]>();
    for (const t of tabs) {
      const key = groupKeyFor(t, groupBy, sevOf);
      const bucket = byKey.get(key);
      if (bucket) bucket.push(t);
      else {
        byKey.set(key, [t]);
        order.push(key);
      }
    }
    if (groupBy === "severity") {
      /* Fixed worst→best order + the workspace's own severity tones/labels, so
         a severity group reads exactly like the item header's status pill. */
      const rank: Record<PlannerSeverity, number> = {
        negative: 0,
        at_zero: 1,
        below_min: 2,
        healthy: 3,
      };
      return order
        .slice()
        .sort(
          (a, b) => rank[a as PlannerSeverity] - rank[b as PlannerSeverity],
        )
        .map((key) => ({
          key,
          label: SEV_TONE[key as PlannerSeverity].label,
          tone: SEV_TONE[key as PlannerSeverity],
          items: byKey.get(key)!,
        }));
    }
    return order.map((key) => ({
      key,
      // Categories surface as their ERP code (C-2131…) app-wide; owner groups
      // keep the person's name. The "Uncategorized" fallback is unmapped, so
      // categoryCodeFor returns it unchanged.
      label: groupBy === "category" ? categoryCodeFor(key) : key,
      tone: FALLBACK_KEYS.has(key) ? UNCATEGORIZED_TONE : groupTone(key),
      items: byKey.get(key)!,
    }));
  }, [tabs, groupBy, severityByCode]);

  /* ── Per-item derived data ── */
  /* Manually-added items (added via the tab-strip "+" Manage-Items modal)
     skip every seeded feed — demand events, PO receipts, and draft POs.
     The user creates the demand/supply themselves; only qualified vendors
     show up on the vendor panel. State + persistence live here so the
     memos below can read the flag without a temporal-dead-zone reference. */
  const MANUAL_STORAGE_KEY = "po:planner:manuallyAddedCodes:v1";
  const [manuallyAddedCodes, setManuallyAddedCodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(MANUAL_STORAGE_KEY);
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set<string>(arr) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const persistManuallyAdded = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* storage full / disabled — fall through silently */
    }
  }, []);
  const isManuallyAddedItem = item ? manuallyAddedCodes.has(item.itemCode) : false;
  const demandEvents = useMemo<PlannerDemandEvent[]>(() => {
    if (!item) return [];
    if (isManuallyAddedItem) return [];
    return getDemandEventsForItem(item)
      .slice()
      .sort((a, b) => a.requiredDate.localeCompare(b.requiredDate));
  }, [item, isManuallyAddedItem]);

  /** Ids of draft SOs — excluded from the projection by default; the buyer
      opts them in from the gap graph (point 14). */
  const draftIds = useMemo(
    () => new Set(demandEvents.filter((d) => d.state === "Draft").map((d) => d.id)),
    [demandEvents],
  );

  const incoming = useMemo<FutureIncomingEvent[]>(() => {
    if (!item) return [];
    /* Store-derived POs + seeded sample supply, so every item shows the
       Supply/Fulfillment flow even when no live PO exists in the store.
       Manually-added items skip the seeded portion so the sandbox starts
       clean; real store POs (if any) still surface. */
    return [
      ...getFutureIncomingForItem(item.itemCode, purchaseOrders),
      ...(isManuallyAddedItem ? [] : getSeededIncomingForItem(item)),
    ].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  }, [item, purchaseOrders, isManuallyAddedItem]);

  /* DRAFT POs — kept SEPARATE from `incoming` on purpose: they feed ONLY the
     graph's display dots (see graphEvents), never `projIncoming`/the curve, so
     a not-yet-sent draft can't inflate projected coverage. Store drafts + one
     seeded sample per item (so the marker is visible on every item). */
  const draftPOs = useMemo<FutureIncomingEvent[]>(() => {
    if (!item) return [];
    return [
      ...getDraftPOsForItem(item.itemCode, purchaseOrders),
      ...(isManuallyAddedItem ? [] : getSeededDraftPOForItem(item)),
    ].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  }, [item, purchaseOrders, isManuallyAddedItem]);

  const poByNumber = useMemo(() => {
    const map = new Map<string, PurchaseOrderData>();
    for (const po of purchaseOrders) map.set(po.poNumber, po);
    return map;
  }, [purchaseOrders]);

  /* Effective inputs = base events with overrides applied (excluded dropped,
     rescheduled dates rewritten) so the projection — and the curve — repaint
     live as the buyer drags / toggles tiles. */
  const effectiveDemand = useMemo<PlannerDemandEvent[]>(
    () =>
      demandEvents
        // Drafts default to excluded; everything else defaults to included.
        .filter((d) => !(overrides.get(d.id)?.excluded ?? d.state === "Draft"))
        .map((d) => {
          const day = overrides.get(d.id)?.dayOffset;
          return day == null ? d : { ...d, requiredDate: isoFromDay(day) };
        }),
    [demandEvents, overrides],
  );

  const effectiveIncoming = useMemo<FutureIncomingEvent[]>(
    () =>
      incoming
        .filter((inc) => !overrides.get(incomingId(inc))?.excluded)
        .map((inc) => {
          const day = overrides.get(incomingId(inc))?.dayOffset;
          return day == null ? inc : { ...inc, expectedDate: isoFromDay(day) };
        }),
    [incoming, overrides],
  );

  /* ── Predicted (mock) transactions → projection inputs ──
     The buyer's what-if events become synthetic demand / incoming records so
     the very same projection math picks them up. They feed both the baseline
     and the enhanced curve (a prediction is part of the scenario's reality),
     so the coverage ribbon reflects them immediately. Excluded mocks are
     dropped, mirroring the toggle behaviour of real events. */
  const mockDemandEvents = useMemo<PlannerDemandEvent[]>(
    () =>
      item
        ? mockEvents
            .filter((m) => m.kind === "demand" && !m.excluded)
            .map((m) => ({
              id: m.id,
              itemCode: item.itemCode,
              qty: m.qty,
              requiredDate: isoFromDay(m.day),
              source: "Request" as const,
              sourceRef: m.label,
              requester: "Forecast",
              reason: "Predicted demand (what-if)",
              priority: "Standard" as const,
              state: "Confirmed" as const,
            }))
        : [],
    [item, mockEvents],
  );
  const mockIncomingEvents = useMemo<FutureIncomingEvent[]>(
    () =>
      item
        ? mockEvents
            .filter((m) => m.kind === "supply" && !m.excluded)
            .map((m) => ({
              poNumber: m.label,
              itemCode: item.itemCode,
              qty: m.qty,
              expectedDate: isoFromDay(m.day),
              status: "Predicted",
            }))
        : [],
    [item, mockEvents],
  );

  /* Transaction-table "Simulate entry" what-ifs → projection inputs. Routing
     them through the curve (not just the table's running balance) makes a sim
     added in the table move the gap graph too — the same way a graph what-if
     already moves the table. Outgoing = demand, incoming = supply; the table
     still renders these via `simulatedEvents`, so they are NOT folded into the
     ledger demand/incoming below (that would double-count them). */
  const simDemandEvents = useMemo<PlannerDemandEvent[]>(
    () =>
      item
        ? simulatedTxns
            .filter((s) => s.direction === "outgoing")
            .map((s) => ({
              id: s.id,
              itemCode: item.itemCode,
              qty: s.qty,
              requiredDate: s.date,
              source: (s.typeLabel === "SO" ? "SO" : "Request") as PlannerDemandEvent["source"],
              sourceRef: s.reference,
              requester: "Simulated",
              reason: "Simulated demand (what-if)",
              priority: "Standard" as const,
              state: "Confirmed" as const,
            }))
        : [],
    [item, simulatedTxns],
  );
  const simIncomingEvents = useMemo<FutureIncomingEvent[]>(
    () =>
      item
        ? simulatedTxns
            .filter((s) => s.direction === "incoming")
            .map((s) => ({
              poNumber: s.reference,
              itemCode: item.itemCode,
              qty: s.qty,
              expectedDate: s.date,
              status: "Predicted",
            }))
        : [],
    [item, simulatedTxns],
  );

  /* Projection inputs = real (effective) events + the predicted ones + the
     table's simulated what-ifs. The gap graph plots this, so the table — which
     reads the same curve for its "Projected stock" column — stays in sync. */
  const projDemand = useMemo<PlannerDemandEvent[]>(
    () => [...effectiveDemand, ...mockDemandEvents, ...simDemandEvents],
    [effectiveDemand, mockDemandEvents, simDemandEvents],
  );
  const projIncoming = useMemo<FutureIncomingEvent[]>(
    /* Eli 2026-07-16: when the drafts toggle is ON, drafts contribute
       to the projected curve so the graph "moves" for them too. When
       OFF (default) drafts stay display-only and don't inflate
       coverage — a draft PO hasn't promised anything yet. */
    () => [
      ...effectiveIncoming,
      ...mockIncomingEvents,
      ...simIncomingEvents,
      ...(showDrafts ? draftPOs : []),
    ],
    [effectiveIncoming, mockIncomingEvents, simIncomingEvents, showDrafts, draftPOs],
  );

  /* Ledger inputs = the SAME effective events the gap-graph curve uses (drafts
     excluded by default, overrides applied) + the predicted ones, so the
     Transaction Table shows exactly the events that drive the curve.
     `predictedTxnIds` lets the stream badge the mocked rows (demand-event id
     for demand; the `incoming-…` id for supply, matching the stream's internal
     key). Simulated table what-ifs are passed separately (`simulatedEvents`),
     so they are intentionally not folded in here. */
  const ledgerDemand = useMemo<PlannerDemandEvent[]>(
    () => [...effectiveDemand, ...mockDemandEvents],
    [effectiveDemand, mockDemandEvents],
  );
  /* Incoming ledger rows mirror the curve's real supply (overrides applied) +
     the predicted what-ifs. Auto-supply events also feed the ledger further
     below (see `ledgerWithAuto`) so the transaction table reads every event
     the graph plots — that concatenation lives after `autoIncomingEvents`
     is defined to avoid a temporal-dead-zone reference. */
  const ledgerIncoming = useMemo<FutureIncomingEvent[]>(
    () => [...effectiveIncoming, ...mockIncomingEvents],
    [effectiveIncoming, mockIncomingEvents],
  );
  const predictedTxnIds = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const d of mockDemandEvents) s.add(d.id);
    for (const inc of mockIncomingEvents) s.add(incomingId(inc));
    return s;
  }, [mockDemandEvents, mockIncomingEvents]);

  /* Proposed POs = selected vendors with an allocated qty. Each lands at its
     planned arrival day (never earlier than the lead time; draggable on the
     gap graph). */
  const manualProposedPOs = useMemo<ProposedPO[]>(() => {
    if (!item) return [];
    // Resolve against the FULL marketplace so a vendor plotted from the graph's
    // "Show all vendors" path (outside the qualified set) still renders its dot.
    // Primary allocations below stay on the qualified set — the default plan is
    // unchanged.
    const vById = new Map(expandedAllVendors.map((v) => [v.vendorId, v]));
    /* Per-vendor primary allocation (id `v-<vendorId>`) — drives the Classic
       Fulfillment graph unchanged. */
    const primary: ProposedPO[] = expandedVendors
      .filter(
        (v) => selectedVendorIds.has(v.vendorId) && (allocations.get(v.vendorId) ?? 0) > 0,
      )
      .map((v) => {
        /* Buyer feedback 2026-07-14: the lead-time floor clamp on
           `arrivalDay` was silently reverting drag targets, making
           left-drag "not work" (state updated, render clamped back).
           Same override philosophy as the vendor picker earlier —
           the buyer may have expedited via a phone call and knows
           earlier arrival is possible. Only clamp against the
           window bounds; the toast warning at `moveEvent` time
           still flags sub-lead-time arrivals so the buyer sees the
           consequence. */
        const arrivalDay = Math.max(
          0,
          Math.min(horizonDays, proposedArrival.get(v.vendorId) ?? v.leadTimeDays),
        );
        return {
          id: `v-${v.vendorId}`,
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          qty: allocations.get(v.vendorId) ?? 0,
          leadTimeDays: v.leadTimeDays,
          arrivalDay,
          orderDay: Math.max(0, arrivalDay - v.leadTimeDays),
          unitPrice: v.unitPrice,
          pricingRules: v.pricingRules,
        };
      });
    /* Extra POs added on the Timeline — only count while their vendor is still
       selected (reselecting restores them). */
    const extras: ProposedPO[] = extraPOs
      .filter((x) => x.qty > 0 && selectedVendorIds.has(x.vendorId) && vById.has(x.vendorId))
      .map((x) => {
        const v = vById.get(x.vendorId)!;
        const arrivalDay = Math.max(0, Math.min(horizonDays, x.arrivalDay));
        return {
          id: x.id,
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          qty: x.qty,
          leadTimeDays: v.leadTimeDays,
          /* Receiving lands on the plotted/dragged day; the order is placed a
             lead time earlier — the graph's non-lifting "Planned PO" point. */
          arrivalDay,
          orderDay: Math.max(0, arrivalDay - v.leadTimeDays),
          unitPrice: v.unitPrice,
          pricingRules: v.pricingRules,
        };
      });
    return [...primary, ...extras];
  }, [item, expandedVendors, expandedAllVendors, selectedVendorIds, allocations, proposedArrival, horizonDays, extraPOs]);

  /* Manual-only proposed incoming — used ONLY as an input to preAutoCurve
     so we can find dips that manual plots haven't yet closed. The full
     `proposedIncoming` below (derived from the MERGED proposedPOs = manual
     + auto) drives the enhanced curve + all downstream consumers. */
  const manualProposedIncoming = useMemo<FutureIncomingEvent[]>(
    () =>
      item
        ? manualProposedPOs.map((p) => ({
            poNumber: `PLAN-${p.id}`,
            itemCode: item.itemCode,
            qty: p.qty,
            expectedDate: isoFromDay(p.arrivalDay),
            status: "Draft",
          }))
        : [],
    [item, manualProposedPOs],
  );

  /* Pre-auto curve — real events + manual proposed POs only. Used to find
     dips the buyer hasn't already covered; the auto-supply generator walks
     THIS curve to decide where to inject vendor plots. */
  const recommendationConfig = useRecommendationConfig(activeCode);
  const recommendationMode = useRecommendationMode(activeCode);
  /* Auto is OFF by default when the buyer lands on the sandbox.
     Buyer feedback 2026-07-14: "auto will not be selected by
     default — user will be intentionally doing that". No seed
     effect — untouched items fall through to `OFF_CONFIG` via
     `getRecommendationConfig`, and the buyer opts in by picking a
     rule (or Custom) in the Auto dropdown. */
  /* Auto-supply breakdown modal — trigger sits inside the selected option
     card in the Auto: dropdown; opens a centralized view with impact stats,
     edge-case advisories, and the per-vendor rollup all in one place.
     Lifted here so the state survives the dropdown's own close. */
  const [autoBreakdownOpen, setAutoBreakdownOpen] = useState(false);
  /* Late-order resolution mode (buyer 2026-07-23) — per-vendor
     choice for POs whose lead time can't hit the requested need-by
     date. Absence = "force" (default: keep the requested arrival,
     accept the vendor will be late). "soonest" = shift arrival to
     orderDay + leadTime (soonest the vendor can realistically
     deliver). The Apply-all action sets every late vendor's key to
     "soonest" in one shot. Cleared when the breakdown modal closes. */
  const [lateResolutions, setLateResolutions] = useState<Record<string, "soonest">>({});
  /* Force-it inline picker — Eli's Option A ("manually pick a vendor +
     amount on the needed date, overriding the lead time"). Only one
     card can be in edit mode at a time. Keyed by the merged card's
     vendorId; the form holds the buyer's picks. Cleared with the modal
     and when the user confirms/cancels. */
  const [forceEditingKey, setForceEditingKey] = useState<string | null>(null);
  const [forceForm, setForceForm] = useState<{ vendorId: string; qty: number } | null>(null);
  /* Accept-soonest picker — Eli 2026-07-31: the buyer should intentionally
     pick which vendor's soonest arrival to accept, not just click a button
     that auto-swaps. Same interaction model as forceEditingKey. */
  const [acceptEditingKey, setAcceptEditingKey] = useState<string | null>(null);
  const [acceptForm, setAcceptForm] = useState<{ vendorId: string } | null>(null);
  /* After a resolution is confirmed, we keep the resolver card visible in
     a "resolved" state that shows a before → after diff (buyer 2026-08-03:
     "when I am confirming this will not disappear we need to show what
     was the previous and what we have updated to"). Keyed by the card's
     stable `p.key` so multiple late cards can be resolved independently
     without collisions. Cleared with the modal. */
  type ResolvedSummary = {
    mode: "accept" | "force";
    /* Original card snapshot — enough to reconstruct the resolver's
       context strip after the merged PO the buyer resolved has been
       materialized into extraPOs (which removes it from orderedPOs).
       Without this snapshot the "different-vendor" resolution path
       loses its resolved card visually because the original p no
       longer exists in the render loop. */
    originalVendorId: string;
    originalVendorName: string;
    originalLeadTimeDays: number;
    originalArrivalDay: number;
    originalQty: number;
    originalUnitPrice: number;
    shortfallDay: number;
    newVendorName: string;
    newLeadTimeDays: number;
    newArrivalDay: number;
    newQty: number;
  };
  const [resolvedByKey, setResolvedByKey] = useState<Record<string, ResolvedSummary>>({});
  useEffect(() => {
    if (!autoBreakdownOpen) {
      setLateResolutions({});
      setForceEditingKey(null);
      setForceForm(null);
      setAcceptEditingKey(null);
      setAcceptForm(null);
      setResolvedByKey({});
    }
  }, [autoBreakdownOpen]);
  /* Pending (uncommitted) rule config. While the dropdown is open the
     buyer's picks land here — the workspace store stays untouched, so
     the graph does NOT reflect changes until they hit one of the two
     CTAs. Closing the dropdown by outside click / escape discards the
     pending config. Buyer 2026-07-19: "don't reflect the graph until
     I hit See on graph". */
  const [pendingConfig, setPendingConfig] = useState<RecommendationConfig | null>(null);
  /* Snapshots — see plannerSnapshotStore. Local state:
       · drawer open/close
       · compare modal + which snapshots to compare
       · "since snapshot" banner (populated after restore) */
  const snapshots = useSnapshotsForItem(activeCode);
  const [compareSnapshots, setCompareSnapshots] = useState<PlannerSnapshot[]>([]);
  const [restoreBanner, setRestoreBanner] = useState<{
    snapshotName: string;
    diff: SnapshotWorldDiff;
  } | null>(null);
  /* The last snapshot the buyer restored — surfaces as a highlighted
     row in the dropdown so they can see "which plan am I looking at
     right now". Cleared when they take a new snapshot (the current
     state is no longer identical to any saved plan). */
  const [lastLoadedSnapshotId, setLastLoadedSnapshotId] = useState<string | null>(null);
  /* Snapshot-view mode (buyer feedback 2026-07-20: "clearly label the
     current/active version vs a snapshot"). Non-null = the workspace
     is rendering a saved snapshot, not the buyer's live plan. Every
     mutation surface across the tree gates on `isSnapshotView` so
     the snapshot reads as static / read-only. `bufferedActive` holds
     the buyer's pre-snapshot workspace state so "Back to active plan"
     restores it exactly with no silent data loss. */
  const [snapshotViewMode, setSnapshotViewMode] = useState<{
    snapshotId: string;
    snapshotName: string;
    createdAt: number;
    bufferedActive: PlannerSnapshotIntent;
  } | null>(null);
  const isSnapshotView = snapshotViewMode !== null;
  /* Make-active confirm — replacing the buffered active plan is
     destructive (the buyer's pre-snapshot work is discarded), so the
     promotion goes through a red-glow confirm. */
  const [confirmMakeActive, setConfirmMakeActive] = useState(false);
  /* Brief "Saved" state on the Take snapshot button — buyer
     feedback 2026-07-14: "need an animation like user will get a
     feel that snapshot is taken". Flips true immediately after a
     successful save and clears itself ~1.2s later. */
  const [snapshotCapturedFlash, setSnapshotCapturedFlash] = useState(false);
  const preAutoCurve = useMemo<ProjectionPoint[]>(
    () =>
      item
        ? projectAtpCurve(
            item,
            projDemand,
            [...projIncoming, ...manualProposedIncoming],
            horizonDays,
          )
        : [],
    [item, projDemand, projIncoming, manualProposedIncoming, horizonDays],
  );
  const autoSupply = useMemo(() => {
    if (!item) return [] as AutoSupplyEvent[];
    return computeAutoSupplyEvents(preAutoCurve, recommendationConfig, item.minLevel, item.maxLevel);
  }, [item, preAutoCurve, recommendationConfig]);

  /* Auto-generated proposed POs — each auto-supply event becomes a REAL
     vendor plot. Runs Eli's Step-1 gate per event:
       1. Can ONE vendor solve this on time? (leadTime ≤ shortfall day
          AND maxOrderQty ≥ needed qty) → single-vendor plot at rank #1
       2. Multiple vendors can solve alone? → still one plot, top rank
       3. No single vendor can cover the qty → split across vendors
          in rank order, each taking up to their max
       4. No vendor can arrive on time → best-available plot, marked
          late; the sequential resolver in AutoBreakdownDialog gates
          the rest of the queue (Force at optimal / Accept soonest)
     Each emitted PO carries an `autoDecision` trace the dialog reveals
     under a "Why this vendor?" click-to-expand. */
  const autoProposedPOs = useMemo<ProposedPO[]>(() => {
    if (!item || autoSupply.length === 0 || expandedVendors.length === 0) return [];

    /* Read a vendor's effective lead time — missing / undefined counts
       as zero (instant). Eli 2026-07-31 explicitly flagged this so the
       engineers don't crash the flow when data is loose: "if a vendor
       has no lead time set, assume zero — better to assume you can
       get it right away than not at all." Mirrors the same
       normalization procurementRecommendations.ts:193 already does. */
    const leadOf = (v: PlannerVendor): number => v.leadTimeDays ?? 0;

    /* Sort by vendor rank (1 = best), then primaryFlag as a tie-break,
       then cheapest unit price. Aligns auto with
       procurementRecommendations.ts:177 so the sandbox and the auto
       recommender agree on which vendor gets the first shot when
       multiple qualify. Buyer 2026-07-31: "yes, more than one →
       highest priority" — priority = rank, not primary flag. */
    const sortByRank = (list: PlannerVendor[]): PlannerVendor[] => {
      return [...list].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.primaryFlag !== b.primaryFlag) return a.primaryFlag ? -1 : 1;
        return a.unitPrice - b.unitPrice;
      });
    };

    /* Round the buyer's shortfall up to the vendor's order-multiple
       floor. Buyer feedback 2026-07-20: "I selected below zero and
       refill to zero, why is my stock going into the below-max
       section?" — the MOQ floor was pushing plot qty above the fill
       target and lifting the projected on-hand curve into a higher
       band than the buyer picked. Auto's job is to honour the buyer's
       trigger + fill-to choice on the graph; MOQ is a real-world
       vendor constraint that surfaces via the `autoIssues.overOrder`
       diagnostic and as a hard check when the buyer converts an auto
       PO to a real draft. Multiples rounding is kept — it's a small,
       unavoidable "increments of N" adjustment. */
    const roundToOrderMultiples = (need: number, v: PlannerVendor): number => {
      const c = vendorConstraints(item, v);
      if (c.orderMultiples > 1) {
        return Math.ceil(need / c.orderMultiples) * c.orderMultiples;
      }
      return need;
    };

    const out: ProposedPO[] = [];
    autoSupply.forEach((a, idx) => {
      /* Full candidate pool — every qualified vendor, ranked. The
         Step-1 gate reads on-time + qty-fit off this list. If no
         vendor can arrive on time we still walk this list (late
         fallback), rather than silently dropping the plot. */
      const ranked = sortByRank(expandedVendors);
      const anyOnTime = ranked.some((v) => leadOf(v) <= a.day);

      /* Candidate rollup for the decision trace — one row per vendor
         the engine looked at, in the same order it walked them. */
      const candidates = ranked.map((v) => {
        const c = vendorConstraints(item, v);
        const lead = leadOf(v);
        return {
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          rank: v.rank,
          leadTimeDays: lead,
          maxOrderQty: c.maxOrderQty,
          canArriveOnTime: lead <= a.day,
          canFulfilAlone: lead <= a.day && c.maxOrderQty >= a.qty,
        };
      });
      const soloCapableCount = candidates.filter((c) => c.canFulfilAlone).length;

      /* STEP 1 — can one vendor solve this on time AND cover qty?
         Pick the highest-rank such vendor. When multiple qualify we
         label the outcome accordingly so the reveal can tell the
         buyer "3 vendors could do this, priority went to Acme". */
      const singleSolver = ranked.find((v) => {
        const c = vendorConstraints(item, v);
        return leadOf(v) <= a.day && c.maxOrderQty >= a.qty;
      });

      if (singleSolver) {
        const qty = roundToOrderMultiples(a.qty, singleSolver);
        const arrivalDay = a.day;
        const lead = leadOf(singleSolver);
        out.push({
          id: `auto-${singleSolver.vendorId}-${a.day}-${idx}-0`,
          vendorId: singleSolver.vendorId,
          vendorName: singleSolver.vendorName,
          qty,
          leadTimeDays: lead,
          arrivalDay,
          orderDay: Math.max(0, arrivalDay - lead),
          unitPrice: singleSolver.unitPrice,
          pricingRules: singleSolver.pricingRules,
          shortfallDay: a.day,
          autoDecision: {
            neededQty: a.qty,
            shortfallDay: a.day,
            candidates,
            outcome:
              soloCapableCount > 1 ? "highest-priority-of-many" : "single-solve",
            chunkIndex: 0,
            chunkCount: 1,
          },
        });
        return;
      }

      /* No single vendor can solve this. Split across ranked vendors,
         each taking up to their cap. If nobody's on time either
         (`!anyOnTime`), every chunk gets the `late-fallback` outcome
         so the reveal says "no vendor arrives in time; here's the
         best-available plan". Otherwise → `split-across-vendors`. */
      const outcome: AutoDecision["outcome"] = anyOnTime
        ? "split-across-vendors"
        : "late-fallback";
      let remaining = a.qty;
      const usedVendorIds = new Set<string>();
      const eventChunks: ProposedPO[] = [];

      for (const v of ranked) {
        if (remaining <= 0) break;
        if (usedVendorIds.has(v.vendorId)) continue;
        usedVendorIds.add(v.vendorId);
        const c = vendorConstraints(item, v);
        const cap = c.maxOrderQty > 0 ? c.maxOrderQty : remaining;
        const rawTake = Math.min(remaining, cap);
        const qty = roundToOrderMultiples(rawTake, v);
        const lead = leadOf(v);
        const arrivalDay = lead <= a.day ? a.day : lead;
        eventChunks.push({
          id: `auto-${v.vendorId}-${a.day}-${idx}-${eventChunks.length}`,
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          qty,
          leadTimeDays: lead,
          arrivalDay,
          orderDay: Math.max(0, arrivalDay - lead),
          unitPrice: v.unitPrice,
          pricingRules: v.pricingRules,
          shortfallDay: a.day,
        });
        remaining -= rawTake;
      }

      /* Guard: if the split loop emitted nothing (impossible with
         non-empty vendor list, but the type system doesn't know),
         plot with the top-ranked vendor at raw qty so the graph
         still lands something. */
      if (eventChunks.length === 0 && ranked.length > 0) {
        const v = ranked[0];
        const qty = roundToOrderMultiples(a.qty, v);
        const lead = leadOf(v);
        const arrivalDay = lead <= a.day ? a.day : lead;
        eventChunks.push({
          id: `auto-${v.vendorId}-${a.day}-${idx}-0`,
          vendorId: v.vendorId,
          vendorName: v.vendorName,
          qty,
          leadTimeDays: lead,
          arrivalDay,
          orderDay: Math.max(0, arrivalDay - lead),
          unitPrice: v.unitPrice,
          pricingRules: v.pricingRules,
          shortfallDay: a.day,
        });
      }

      /* Stamp each chunk with the shared decision trace, differing
         only by chunkIndex/chunkCount. Buyer sees "chunk 2 of 3"
         plus the full candidate list in the reveal. */
      const chunkCount = eventChunks.length;
      eventChunks.forEach((chunk, i) => {
        chunk.autoDecision = {
          neededQty: a.qty,
          shortfallDay: a.day,
          candidates,
          outcome,
          chunkIndex: i,
          chunkCount,
        };
        out.push(chunk);
      });
    });
    /* Drop entries the buyer has materialized into `extraPOs` for
       editing (buyer 2026-07-29 "unable to edit the fulfillment when
       I am in auto mode") OR explicitly deleted from the graph
       (buyer 2026-07-30 "delete is not working on a plotted auto
       item"). Skipping here prevents the generator from re-emitting
       the entry on the next render. */
    if (materializedAutoIds.size === 0 && suppressedAutoIds.size === 0) return out;
    return out.filter(
      (p) => !materializedAutoIds.has(p.id) && !suppressedAutoIds.has(p.id),
    );
  }, [item, autoSupply, expandedVendors, materializedAutoIds, suppressedAutoIds]);

  /* Auto-supply diagnostics — surfaces the interesting edge cases the
     buyer should know about, for the Auto: dropdown footer:
       · `overOrder`  — units ordered ABOVE what we actually need
                        because at least one vendor's MOQ overshot.
       · `splitDays`  — number of shortfall events split across two or
                        more vendors (one vendor's max couldn't cover).
       · `lateCount`  — orders whose arrival day slips past the day the
                        shortfall opens (no vendor can arrive in time).
     Recomputed off the same inputs as autoProposedPOs so nothing goes
     out of sync. */
  const autoIssues = useMemo(() => {
    if (autoSupply.length === 0 || autoProposedPOs.length === 0) {
      return {
        overOrder: 0,
        splitDays: 0,
        lateCount: 0,
        overOrderVendors: [] as string[],
        lateVendors: [] as string[],
      };
    }
    const orderedByDay = new Map<number, ProposedPO[]>();
    for (const p of autoProposedPOs) {
      const arr = orderedByDay.get(p.orderDay + p.leadTimeDays) ?? [];
      // Key by the shortfall day (a.day) — encoded in the id "-<idx>-<sub>".
      const parts = p.id.split("-");
      const dayFromId = Number(parts[parts.length - 3]);
      const dayKey = Number.isFinite(dayFromId) ? dayFromId : p.arrivalDay;
      const list = orderedByDay.get(dayKey) ?? [];
      list.push(p);
      orderedByDay.set(dayKey, list);
      void arr;
    }
    const needByDay = new Map<number, number>();
    autoSupply.forEach((a) => needByDay.set(a.day, (needByDay.get(a.day) ?? 0) + a.qty));

    let overOrder = 0;
    let splitDays = 0;
    let lateCount = 0;
    /* Track WHICH vendors cause each issue — surfaced in the advisory
       ribbons so the buyer can see who to negotiate with (MOQ overshoot)
       or replace (late arrival). Dedupe via a Set of vendor names. */
    const overOrderVendorSet = new Set<string>();
    const lateVendorSet = new Set<string>();
    for (const [day, list] of orderedByDay) {
      const need = needByDay.get(day) ?? 0;
      const ordered = list.reduce((s, p) => s + p.qty, 0);
      if (ordered > need) {
        overOrder += ordered - need;
        for (const p of list) overOrderVendorSet.add(p.vendorName);
      }
      if (list.length > 1) splitDays += 1;
      for (const p of list) {
        if (p.arrivalDay > day) {
          lateCount += 1;
          lateVendorSet.add(p.vendorName);
        }
      }
    }
    return {
      overOrder,
      splitDays,
      lateCount,
      overOrderVendors: [...overOrderVendorSet],
      lateVendors: [...lateVendorSet],
    };
  }, [autoSupply, autoProposedPOs]);

/* Merged proposed POs — manual + auto. Every downstream consumer
     (graph events, curve, cart CTA count, ledger PLANNED rows) reads this
     one list so both flavours behave identically. */
  const proposedPOs = useMemo<ProposedPO[]>(
    () => [...manualProposedPOs, ...autoProposedPOs],
    [manualProposedPOs, autoProposedPOs],
  );

  const isAutoOn = recommendationConfig.trigger !== "off";


  const arrivalByVendor = useMemo(() => {
    const m = new Map<string, number>();
    // Primary allocation only (`v-` POs) — the Classic Fulfillment graph's
    // one-lane-per-vendor model; extra POs don't move the vendor's lane.
    for (const p of proposedPOs) if (p.id.startsWith("v-")) m.set(p.vendorId, p.arrivalDay);
    return m;
  }, [proposedPOs]);

  const proposedIncoming = useMemo<FutureIncomingEvent[]>(
    () =>
      item
        ? proposedPOs.map((p) => ({
            poNumber: `PLAN-${p.id}`,
            itemCode: item.itemCode,
            qty: p.qty,
            expectedDate: isoFromDay(p.arrivalDay),
            status: "Draft",
          }))
        : [],
    [item, proposedPOs],
  );

  /* Planned vendor POs as Transaction-Table rows (blue PLANNED badge). These
     mirror the proposed-PO supply the enhanced curve already plots — auto
     POs land here too so every bump in the table's "Projected stock" column
     has a row that explains it. */
  const plannedIncomingRows = useMemo<PlannedIncomingTxn[]>(
    () =>
      proposedPOs.map((p) => ({
        id: `plan-${p.id}`,
        vendorName: p.vendorName,
        qty: p.qty,
        expectedDate: isoFromDay(p.arrivalDay),
        /* The order date (arrival − lead time) — the table's "Order by" column,
           mirroring the gap graph's hollow Planned-PO diamond. */
        orderDate: isoFromDay(p.orderDay),
      })),
    [proposedPOs],
  );

  /* Baseline = today's reality, no proposed POs. Stable references for the
     coverage target + the need-by deadline marker (the buyer's own plan must
     not move the customer's deadline). */
  const baselineCurve = useMemo<ProjectionPoint[]>(
    () => (item ? projectAtpCurve(item, projDemand, projIncoming, horizonDays) : []),
    [item, projDemand, projIncoming, horizonDays],
  );

  /* Enhanced = baseline + all proposed POs (manual + auto). The auto lift is
     already in `proposedIncoming` above, so no separate autoIncomingEvents
     concat is needed. */
  const curve = useMemo<ProjectionPoint[]>(
    () =>
      item
        ? projectAtpCurve(
            item,
            projDemand,
            [...projIncoming, ...proposedIncoming],
            horizonDays,
          )
        : [],
    [item, projDemand, projIncoming, proposedIncoming, horizonDays],
  );

  /* day → projected ATP, from the enhanced curve. Handed to the Transaction
     Table so its "Projected stock" column reads the very same curve the graph
     plots — the table value IS the graph value at that date, never a separate
     accumulation that can drift. */
  const atpByDay = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>();
    for (const p of curve) m.set(p.day, p.atp);
    return m;
  }, [curve]);

  const baseline = useMemo(() => {
    if (!item || baselineCurve.length === 0) {
      return { worst: 0, deadlineDay: null as number | null };
    }
    const worst = Math.min(...baselineCurve.map((p) => p.atp));
    const dl = firstViolationDate(baselineCurve, item.minLevel);
    return { worst, deadlineDay: dl ? Math.max(0, daysFromToday(dl)) : null };
  }, [item, baselineCurve]);
  /* Recommended vendor lead time — sets the gap between the two default anchors
     + the calendar hint copy; the lines are otherwise independent. */
  const recommendedLeadDays = useMemo<number | null>(() => {
    if (!item) return null;
    const v = item.qualifiedVendors.find((x) => x.primaryFlag) ?? item.qualifiedVendors[0];
    return v ? v.leadTimeDays : null;
  }, [item]);
  /* Anchor lines are HIDDEN until the buyer adds them from the Add modal (the
     floating day-click chooser). `needByDay`/`orderByDay` are therefore null
     until an override is set — and the graph renders no line / pill / drag-strip
     for a null day. The centered, lead-apart `default*Day` values below are the
     SUGGESTED positions the modal's "Add" button drops a fresh line at; from
     there each line drags independently across the full window. */
  const anchorLead = recommendedLeadDays ?? 7;
  const windowCenter = Math.round(horizonDays / 2);
  const defaultNeedByDay = Math.max(
    0,
    Math.min(horizonDays, windowCenter + Math.round(anchorLead / 2)),
  );
  const defaultOrderByDay = Math.max(0, Math.min(horizonDays, defaultNeedByDay - anchorLead));
  const needByDay = needByOverride;
  const orderByDay = orderByOverride;

  /* Gap-graph tiles: consuming demand (SO / Request) + incoming supply +
     proposed POs. LowStock rows are reorder signals (not consuming demand),
     so they live in the table but not as draggable tiles. */
  const graphEvents = useMemo<GapGraphEvent[]>(() => {
    const list: GapGraphEvent[] = [];
    for (const d of demandEvents) {
      if (d.source === "LowStock") continue;
      const out = outstandingQty(d);
      if (out <= 0) continue;
      const ov = overrides.get(d.id);
      const isDraft = d.state === "Draft";
      const baseDay = Math.max(0, daysFromToday(d.requiredDate));
      list.push({
        id: d.id,
        kind: "demand",
        label: d.sourceRef,
        sublabel: d.customer ?? d.requester,
        qty: out,
        day: Math.max(0, Math.min(horizonDays, ov?.dayOffset ?? baseDay)),
        excluded: ov?.excluded ?? isDraft,
        draft: isDraft,
        tag: d.source === "SO" ? "SO" : "REQ",
      });
    }
    for (const inc of incoming) {
      const id = incomingId(inc);
      const ov = overrides.get(id);
      const baseDay = Math.max(0, daysFromToday(inc.expectedDate));
      list.push({
        id,
        kind: "incoming",
        label: inc.poNumber,
        qty: inc.qty,
        day: Math.max(0, Math.min(horizonDays, ov?.dayOffset ?? baseDay)),
        excluded: ov?.excluded ?? false,
      });
    }
    // Draft POs — visible only when the shared drafts toggle is ON
    // (Eli 2026-07-16). When ON, drafts also lift the projected curve
    // via projIncoming above; when OFF they're hidden from graph AND
    // table AND curve so every surface reads the same reality.
    if (showDrafts) {
      for (const d of draftPOs) {
        list.push({
          id: `draft-${d.poNumber}-${d.itemCode}`,
          kind: "incoming",
          /* Label = vendor name so the day-card row resolves the vendor logo +
             lead time (like a planned-vendor row); PO number rides as sublabel. */
          label: d.vendorName ?? d.poNumber,
          sublabel: d.poNumber,
          qty: d.qty,
          day: Math.max(0, Math.min(horizonDays, daysFromToday(d.expectedDate))),
          excluded: false,
          draftPO: true,
          createdBy: d.createdBy,
        });
      }
    }
    for (const p of proposedPOs) {
      list.push({
        // Primary keeps the `proposed-<vendorId>` id (Classic gap graph + drag
        // routing unchanged); extras use a distinct `extrapo-<id>` route.
        id: p.id.startsWith("v-") ? `proposed-${p.vendorId}` : `extrapo-${p.id}`,
        kind: "proposed",
        label: p.vendorName,
        qty: p.qty,
        day: p.arrivalDay,
        orderDay: p.orderDay,
        excluded: false,
        /* Auto-generated POs are NOT draggable. Flag them here so
           clusterData's manualUserEvents filter excludes them (no
           draggableId → no drag), and clusterShape renders them
           with a dashed ring so the buyer sees they're system-
           suggested. To move an auto PO the buyer must first
           switch auto off. Buyer feedback 2026-07-14. */
        autoRecommendation: p.id.startsWith("auto-"),
      });
    }
    // Predicted (mock) transactions — ghost tiles in both views.
    for (const m of mockEvents) {
      list.push({
        id: m.id,
        kind: m.kind === "demand" ? "demand" : "incoming",
        label: m.label,
        sublabel: "Predicted",
        qty: m.qty,
        day: Math.max(0, Math.min(horizonDays, m.day)),
        excluded: m.excluded ?? false,
        draft: true,
        mock: true,
      });
    }
    // Simulated what-ifs — the SINGLE shared store fed by BOTH the Transaction
    // Table's "Simulate" and the graph's own Simulate add. Plotted here as dots
    // so the graph and the table always show the SAME entries on the SAME day.
    // The curve already reflects them via simDemand/simIncoming, so these
    // markers are display-only (no double-count: the graph plots `curve` for
    // the math and `events` only for the dots).
    for (const s of simulatedTxns) {
      list.push({
        id: s.id,
        kind: s.direction === "incoming" ? "incoming" : "demand",
        label: s.reference,
        sublabel: "Simulated",
        qty: s.qty,
        day: Math.max(0, Math.min(horizonDays, daysFromToday(s.date))),
        excluded: false,
        draft: true,
        mock: true,
      });
    }
    /* Auto-supply events (Rida D3/D4, Areeb I2/I3) now live inside
       `proposedPOs` (auto-picked vendor per event), so the earlier
       for-loop that emitted dashed hollow "Auto" dots is gone. They
       render alongside manual vendor plots via the `proposedPOs` loop
       above — same blue ringed dot, same graph interaction. */
    return list;
  }, [demandEvents, incoming, proposedPOs, overrides, horizonDays, mockEvents, simulatedTxns, draftPOs, showDrafts, item]);

  /* Timeline-only superset: the shared graphEvents (which the Classic gap graph
     also reads) plus the reorder-point alerts rendered as non-consuming amber
     "signal" markers. LowStock is a reorder trigger, not consuming demand —
     projectAtpCurve skips it — so it shows in the Timeline's Demand lane purely
     for context. Keeping these out of graphEvents leaves Classic untouched. */
  const timelineEvents = useMemo<GapGraphEvent[]>(() => {
    const lowStock: GapGraphEvent[] = demandEvents
      .filter((d) => d.source === "LowStock")
      .map((d) => {
        const ov = overrides.get(d.id);
        const baseDay = Math.max(0, daysFromToday(d.requiredDate));
        return {
          id: d.id,
          kind: "demand" as const,
          label: d.sourceRef,
          sublabel: d.requester ?? "Reorder point",
          qty: d.qty,
          day: Math.max(0, Math.min(horizonDays, ov?.dayOffset ?? baseDay)),
          excluded: ov?.excluded ?? false,
          tag: "LOW",
          signal: true,
        };
      });
    return [...graphEvents, ...lowStock];
  }, [graphEvents, demandEvents, overrides, horizonDays]);

  /* Headline metrics — from the enhanced curve (reflects the current plan). */
  const metrics = useMemo(() => {
    if (!item || curve.length === 0) {
      return {
        atp: 0,
        worst: 0,
        severity: "healthy" as PlannerSeverity,
        deadline: null as string | null,
        deadlineDay: null as number | null,
      };
    }
    const atp = currentAtpOfCurve(curve);
    const worst = Math.min(...curve.map((p) => p.atp));
    const severity = worstSeverityInHorizon(curve, item.minLevel);
    const deadline = firstViolationDate(curve, item.minLevel);
    return {
      atp,
      worst,
      severity,
      deadline,
      deadlineDay: deadline ? Math.max(0, daysFromToday(deadline)) : null,
    };
  }, [item, curve]);

  /* ── What-if handlers (fed to the gap graph) ── */
  /* Throttle warning toasts during drag — every pixel of pointermove
     invokes moveEvent, and we only want ONE warning per invalid attempt.
     Ref-tracked so the flag survives cross-frame invocations. */
  const dragWarnRef = useRef<{ id: string; kind: string } | null>(null);
  const warnOnce = (id: string, kind: string, msg: string) => {
    const cur = dragWarnRef.current;
    if (cur && cur.id === id && cur.kind === kind) return;
    dragWarnRef.current = { id, kind };
    toast.warning(msg);
    // Reset shortly so a subsequent drag can re-warn if the buyer tries again.
    setTimeout(() => {
      if (dragWarnRef.current?.id === id && dragWarnRef.current?.kind === kind) {
        dragWarnRef.current = null;
      }
    }, 1500);
  };
  const moveEvent = (id: string, newDay: number) => {
    // Simulated what-if entries reschedule themselves via `simulatedTxns`
    // (the shared store the table also reads). Their id format is `sim-<n>`.
    if (id.startsWith("sim-")) {
      const clampedDay = Math.max(0, Math.min(horizonDays, newDay));
      const newDate = isoFromDay(clampedDay);
      setSimulatedTxns((prev) =>
        prev.map((s) => (s.id === id ? { ...s, date: newDate } : s)),
      );
      return;
    }
    // Predicted (mock) tiles reschedule themselves.
    if (id.startsWith("mock-")) {
      setMockEvents((prev) =>
        prev.map((m) => (m.id === id ? { ...m, day: Math.max(0, Math.min(horizonDays, newDay)) } : m)),
      );
      return;
    }
    // Extra PO tiles — warn (advisory only, per 2026-07-14 override
    // philosophy) if the buyer tries to arrive earlier than the vendor's
    // stated lead time. The render side no longer clamps to leadTime,
    // so the dot moves where the buyer drags; the toast explains the
    // consequence without blocking.
    if (id.startsWith("extrapo-")) {
      const xid = id.slice("extrapo-".length);
      /* Auto-generated POs (xid starts with `auto-`) are marked
         `autoRecommendation: true` at graphEvents-assembly time, so
         clusterData excludes them from `manualUserEvents` and
         they never get a draggableId — the plan-hit button won't
         start a drag on them. Reaching this branch with an auto-
         prefixed xid means something upstream regressed; bail
         quietly rather than materializing state the buyer didn't
         ask for. Buyer feedback 2026-07-14. */
      if (xid.startsWith("auto-")) return;
      const xpo = extraPOs.find((x) => x.id === xid);
      if (xpo) {
        const vendor = expandedAllVendors.find((v) => v.vendorId === xpo.vendorId);
        if (vendor && newDay < vendor.leadTimeDays) {
          warnOnce(id, "leadTime", `${vendor.vendorName}: earliest arrival is day +${vendor.leadTimeDays} (lead time).`);
        }
      }
      setExtraPOs((prev) =>
        prev.map((x) => (x.id === xid ? { ...x, arrivalDay: Math.max(0, Math.min(horizonDays, newDay)) } : x)),
      );
      return;
    }
    // Primary proposed-PO tile (`proposed-<vendorId>`) — same clamp + warn
    // treatment. The read-side clamp in proposedPOs enforces the floor
    // visually.
    if (id.startsWith("proposed-")) {
      const vendorId = id.slice("proposed-".length);
      const vendor = expandedVendors.find((v) => v.vendorId === vendorId) ?? expandedAllVendors.find((v) => v.vendorId === vendorId);
      if (vendor && newDay < vendor.leadTimeDays) {
        warnOnce(id, "leadTime", `${vendor.vendorName}: earliest arrival is day +${vendor.leadTimeDays} (lead time).`);
      }
      setProposedArrival((prev) => {
        if (prev.get(vendorId) === newDay) return prev;
        const next = new Map(prev);
        next.set(vendorId, newDay);
        return next;
      });
      return;
    }
    // Auto-generated proposed POs are ephemeral (re-emit every render from
    // `autoSupply`); dragging them makes no sense — no state to update. Warn
    // once and bail.
    if (id.startsWith("auto-")) {
      warnOnce(id, "auto", "Auto-generated POs aren't draggable — toggle Auto: Off first to move them.");
      return;
    }
    setOverrides((prev) => {
      if (prev.get(id)?.dayOffset === newDay) return prev; // no-op, avoids churn
      const next = new Map(prev);
      next.set(id, { ...prev.get(id), dayOffset: newDay });
      return next;
    });
  };
  const toggleEvent = (id: string) => {
    if (id.startsWith("mock-")) {
      setMockEvents((prev) =>
        prev.map((m) => (m.id === id ? { ...m, excluded: !m.excluded } : m)),
      );
      return;
    }
    setOverrides((prev) => {
      const cur = prev.get(id);
      // Effective default differs: draft SOs start excluded, others included.
      const currentlyExcluded = cur?.excluded ?? draftIds.has(id);
      const next = new Map(prev);
      next.set(id, { ...cur, excluded: !currentlyExcluded });
      return next;
    });
  };

  /* ── Predicted (mock) transaction handlers ── */
  const addMock = (
    kind: "demand" | "supply",
    qty: number,
    day: number,
    /** Display label base (e.g. the chosen type "Sales order"); falls back to
        the generic "Predicted demand/supply" for the Timeline's quick-add. */
    labelBase?: string,
  ) => {
    const id = `mock-${kind}-${mockSeq.current++}`;
    const n = mockEvents.filter((m) => m.kind === kind).length + 1;
    const base = labelBase || (kind === "demand" ? "Predicted demand" : "Predicted supply");
    setMockEvents((prev) => [
      ...prev,
      {
        id,
        kind,
        qty: Math.max(1, Math.round(qty)),
        day: Math.max(0, Math.min(horizonDays, Math.round(day))),
        label: `${base} ${n}`,
      },
    ]);
  };
  const removeMock = (id: string) => {
    setMockEvents((prev) => prev.filter((m) => m.id !== id));
  };

  /* ── Extra-PO handlers (Timeline "+ Add PO" per vendor) ── */
  const addExtraPO = (vendorId: string) => {
    if (!item) return;
    const v = expandedVendors.find((x) => x.vendorId === vendorId);
    if (!v) return;
    const c = vendorConstraints(item, v);
    const id = `xpo-${extraSeq.current++}`;
    setExtraPOs((prev) => [...prev, { id, vendorId, qty: c.moq, arrivalDay: v.leadTimeDays }]);
  };
  const removeExtraPO = (id: string) =>
    setExtraPOs((prev) => prev.filter((x) => x.id !== id));
  const setExtraPOQty = (id: string, qty: number) =>
    setExtraPOs((prev) => prev.map((x) => (x.id === id ? { ...x, qty: Math.max(0, qty) } : x)));

  /* ── Edit-in-place — buyer feedback 2026-07-20 ──
     When the buyer clicks Edit on a plotted extra PO (extrapo-*), we
     stash its id here. The next commit of the wizard (plotVendorAt)
     removes the old row before adding the new one so the plot is
     replaced instead of duplicated. Cancel just clears the id and
     leaves the original in place. */
  const [editingExtraPOId, setEditingExtraPOId] = useState<string | null>(null);
  /* Pre-fills for the wizard when opening in edit mode. Threaded
     down through PlannerAddChooser into SupplyPlanWizard so Step 1
     opens with the plot's qty + Step 2 with the vendor pre-selected. */
  const editingExtraPO = useMemo(() => {
    if (!editingExtraPOId) return null;
    return extraPOs.find((x) => x.id === editingExtraPOId) ?? null;
  }, [editingExtraPOId, extraPOs]);

  /* ── Plot a vendor straight onto the gap graph (chooser → vendor list) ──
     Adds a proposed PO for the chosen vendor as a blue "planned" dot, reusing
     the extra-PO mechanism. Arrival is the EXACT clicked day — honoured even
     when it's before the vendor's lead time (a what-if; an "early" flag is then
     shown on the chooser + the day-detail card).

     When called with an editing target set (editingExtraPOId), the
     old row is removed first so the edit reads as a replace, not an
     append. */
  const plotVendorAt = (
    vendorId: string,
    day: number,
    qty: number,
    plan?: { mode: PlanMode },
  ) => {
    if (!item) return;
    // Superset lookup: the plotted vendor may be a non-qualified one chosen via
    // the graph's "Show all vendors" path.
    const v = expandedAllVendors.find((x) => x.vendorId === vendorId);
    if (!v) return;
    const c = vendorConstraints(item, v);
    const id = `xpo-${extraSeq.current++}`;
    /* Max is a SOFT ceiling — honour an over-max qty from the chooser (MOQ floors). */
    const clampedQty = Math.max(c.moq, Math.round(qty));
    /* The clicked day is the ORDER date in "orderOn" mode (stock arrives a lead
       time later) or the RECEIVING date in "needBy" mode (the default — the
       order is back-dated). We store the arrival (the curve-lifting day); the
       order day is derived as arrival − lead time in proposedPOs. */
    const clickedDay = Math.max(0, Math.min(horizonDays, Math.round(day)));
    const arrivalDay =
      plan?.mode === "orderOn"
        ? Math.min(horizonDays, clickedDay + v.leadTimeDays)
        : clickedDay;
    // The vendor must be selected for its extra PO to count toward the plan
    // (proposedPOs gates extras on selection). Add it without an allocation so
    // only the plotted dot appears — no auto primary allocation.
    setSelectedVendorIds((prev) => new Set(prev).add(vendorId));
    setExtraPOs((prev) => {
      const cleared = editingExtraPOId ? prev.filter((x) => x.id !== editingExtraPOId) : prev;
      return [...cleared, { id, vendorId, qty: clampedQty, arrivalDay }];
    });
    setEditingExtraPOId(null);
  };

  /* Start an edit for a plotted extra PO — signalled from the graph's
     day-card. Snapshotted here so both the chooser pre-fills and the
     final plot-replace path stay in sync. */
  const handleStartEditExtraPO = (eventId: string) => {
    /* Graph event ids come prefixed ("extrapo-{id}"); strip so we
       match the raw id we stored on setExtraPOs. */
    const rawId = eventId.startsWith("extrapo-") ? eventId.slice("extrapo-".length) : eventId;

    /* Auto-generated proposed POs (rawId starts with "auto-") aren't
       in extraPOs — they're re-emitted every render from autoSupply.
       To let the buyer edit them without turning off Auto mode
       (buyer 2026-07-29), materialize the auto row into a real
       ExtraPO here and mark its auto id as materialized so the
       generator stops re-emitting the original. The wizard then
       drives the edit through the existing extraPOs pathway; on
       commit, plotVendorAt replaces the materialized entry with
       whatever the buyer chose. */
    if (rawId.startsWith("auto-")) {
      const src = autoProposedPOs.find((p) => p.id === rawId);
      if (!src) return;
      const newId = `xpo-${extraSeq.current++}`;
      setExtraPOs((prev) => [
        ...prev,
        {
          id: newId,
          vendorId: src.vendorId,
          qty: src.qty,
          arrivalDay: src.arrivalDay,
        },
      ]);
      setSelectedVendorIds((prev) => {
        if (prev.has(src.vendorId)) return prev;
        return new Set(prev).add(src.vendorId);
      });
      setMaterializedAutoIds((prev) => {
        if (prev.has(rawId)) return prev;
        const next = new Set(prev);
        next.add(rawId);
        return next;
      });
      setEditingExtraPOId(newId);
      return;
    }

    const target = extraPOs.find((x) => x.id === rawId);
    if (!target) return;
    setEditingExtraPOId(target.id);
  };
  const handleCancelEditExtraPO = () => setEditingExtraPOId(null);

  /* ── Simulated-transaction handlers (Transaction Table header) ── */
  const addSimulatedTxn = (d: {
    direction: TransactionDirection;
    typeLabel: string;
    qty: number;
    date: string;
  }) => {
    const n = simSeq.current + 1;
    simSeq.current = n;
    const id = `sim-${n}`;
    // Auto-derive a typed document id from the chosen type (a simulated sales
    // order reads "SO-SIM-001") — no manual reference needed.
    const reference = `${SIM_ID_PREFIX[d.typeLabel] ?? "SIM"}-SIM-${String(n).padStart(3, "0")}`;
    setSimulatedTxns((prev) => [
      ...prev,
      {
        id,
        direction: d.direction,
        typeLabel: d.typeLabel,
        qty: Math.abs(Math.round(d.qty)),
        date: d.date,
        reference,
      },
    ]);
  };
  const removeSimulatedTxn = (id: string) =>
    setSimulatedTxns((prev) => prev.filter((s) => s.id !== id));

  /* ── Remove plotted hypotheticals from the gap graph ──
     The graph's "you added this" entries carry id prefixes (same scheme
     moveEvent routes on): a planned vendor PO is `proposed-<vendorId>` (a
     primary allocation) or `extrapo-<id>` (a plotted extra); a simulated
     demand/supply what-if is `mock-…`. This FULLY removes one entry — not the
     legend's hide. */
  const removeGraphEvent = (id: string) => {
    /* Simulated what-ifs are the shared table↔graph store — removing the dot
       on the graph removes the row in the table (and vice versa). */
    if (id.startsWith("sim-")) {
      removeSimulatedTxn(id);
      return;
    }
    if (id.startsWith("mock-")) {
      removeMock(id);
      return;
    }
    if (id.startsWith("extrapo-")) {
      removeExtraPO(id.slice("extrapo-".length));
      return;
    }
    if (id.startsWith("auto-")) {
      /* Auto POs regenerate from autoSupply every render, so simply
         "removing" one from a derived array does nothing — the next
         render brings it back. Suppression set is filtered out of
         autoProposedPOs above. */
      setSuppressedAutoIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      return;
    }
    if (id.startsWith("proposed-")) {
      const vendorId = id.slice("proposed-".length);
      setAllocations((prev) => {
        if (!prev.has(vendorId)) return prev;
        const next = new Map(prev);
        next.delete(vendorId);
        return next;
      });
    }
  };

  /* Two independently-clearable categories of plotted hypotheticals:
       • Purchase orders — every vendor plot (panel allocations + Timeline/graph
         extra POs + their arrival days).
       • Simulations — all what-if demand/supply (the SHARED `simulatedTxns`,
         used by BOTH the table and the graph, plus any legacy `mockEvents`).
     "Clear all" does both. Real demand and real/seeded incoming POs are never
     touched, so the curve falls back to the baseline. */
  const clearProposedPOs = () => {
    setExtraPOs([]);
    setAllocations(new Map());
    setProposedArrival(new Map());
    setSuppressedAutoIds(new Set());
    /* Also exit auto mode. Buyer feedback 2026-07-14: "Activate the
       clear button in auto mode so I can go out — currently I am
       stuck". Without this, auto would immediately re-generate its
       proposed POs on the next render, defeating the click. */
    if (activeCode) setRecommendationConfig(activeCode, OFF_CONFIG);
  };
  const clearSimulations = () => {
    setMockEvents([]);
    setSimulatedTxns([]);
  };
  const clearGraphSimulations = () => {
    clearProposedPOs();
    clearSimulations();
  };

  const hasOverrides = useMemo(
    () => [...overrides.values()].some((o) => o.dayOffset != null || o.excluded),
    [overrides],
  );

  /* ── Snapshots — take + restore ─────────────────────────────────
     Captures the buyer's intent plus the current world fingerprint
     so a later open/compare can surface what changed. Metrics are
     cached at save time so the drawer + compare list don't re-run
     projection to render. */
  const currentWorld = useMemo<PlannerSnapshotWorld | null>(() => {
    if (!item) return null;
    return {
      onHand: item.onHand,
      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
      demandEventIds: demandEvents.map((e) => e.id),
      incomingIds: incoming.map((e) => e.poNumber),
      draftPOIds: draftPOs.map((d) => d.poNumber),
      qualifiedVendorIds: expandedAllVendors.map((v) => v.vendorId),
    };
  }, [item, demandEvents, incoming, draftPOs, expandedAllVendors]);

  const handleTakeSnapshot = () => {
    if (!activeCode || !item || !currentWorld) return;
    const poCount = proposedPOs.length;
    const vendorSet = new Set(proposedPOs.map((p) => p.vendorId));
    const totalUnits = proposedPOs.reduce((s, p) => s + p.qty, 0);
    const totalCost = proposedPOs.reduce((s, p) => s + p.qty * p.unitPrice, 0);
    const lateCount = proposedPOs.filter((p) => p.arrivalDay > needByDay).length;
    /* Auto-generated snapshot name: "Plan N — <date>". Buyer can
       rename in the drawer. Uses count of existing snapshots + 1 so
       names stay stable through deletes. */
    const nextIndex = snapshots.length + 1;
    const now = Date.now();
    const d = new Date(now);
    const dateSlug = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getDate()}`;
    const snap: PlannerSnapshot = {
      id: `snap-${now}-${Math.random().toString(36).slice(2, 8)}`,
      itemCode: activeCode,
      name: `Plan ${nextIndex} · ${dateSlug}`,
      createdAt: now,
      intent: {
        allocations: Array.from(allocations.entries()),
        proposedArrival: Array.from(proposedArrival.entries()),
        extraPOs: extraPOs.map((x) => ({ ...x })),
        mockEvents: mockEvents.map((m) => ({ ...m })),
        simulatedTxns: simulatedTxns.map((s) => ({ ...s })),
        overrides: Array.from(overrides.entries()).map(([k, v]) => [k, { ...v }] as [string, { dayOffset?: number; excluded?: boolean }]),
        selectedVendorIds: Array.from(selectedVendorIds),
        horizonDays,
        horizonStartDay,
        recommendationConfig: { ...recommendationConfig },
      },
      world: currentWorld,
      metrics: {
        poCount,
        vendorCount: vendorSet.size,
        totalUnits,
        totalCost,
        lateCount,
      },
      /* Capture the projected-on-hand curve at save time — powers
         the plan image / sparkline in the compare modal (buyer
         feedback 2026-07-20: "show the plan image as well for each
         plan and the ability to preview"). Just the atp values;
         days are inferred by index. */
      curvePreview: curve.map((p) => p.atp),
    };
    addSnapshot(snap);
    /* Freshly taken snapshot is by definition identical to the
       current state — mark it as loaded so the dropdown highlights
       it. Any later plot edit will visually diverge from this row
       (it stays highlighted until the buyer opens a different one
       or takes another). */
    setLastLoadedSnapshotId(snap.id);
    /* Kick off the "Saved" flash + count-badge pulse. Cleared
       ~1.2s later so subsequent clicks re-fire cleanly. */
    setSnapshotCapturedFlash(true);
    window.setTimeout(() => setSnapshotCapturedFlash(false), 1200);
  };

  const handleOpenSnapshot = (snap: PlannerSnapshot) => {
    if (!activeCode || snap.itemCode !== activeCode) return;
    /* Buffer the buyer's pre-snapshot ("active") workspace state on
       first entry so "Back to active plan" restores it exactly. When
       the workspace is already in snapshot view (buyer opened a
       different snapshot from within the drawer), the buffered active
       state is preserved — it's still what "back" should restore. */
    if (!snapshotViewMode) {
      const bufferedActive: PlannerSnapshotIntent = {
        allocations: Array.from(allocations.entries()),
        proposedArrival: Array.from(proposedArrival.entries()),
        extraPOs: extraPOs.map((x) => ({ ...x })),
        mockEvents: mockEvents.map((m) => ({ ...m })),
        simulatedTxns: simulatedTxns.map((s) => ({ ...s })),
        overrides: Array.from(overrides.entries()).map(
          ([k, v]) => [k, { ...v }] as [string, { dayOffset?: number; excluded?: boolean }],
        ),
        selectedVendorIds: Array.from(selectedVendorIds),
        horizonDays,
        horizonStartDay,
        recommendationConfig: { ...recommendationConfig },
      };
      setSnapshotViewMode({
        snapshotId: snap.id,
        snapshotName: snap.name,
        createdAt: snap.createdAt,
        bufferedActive,
      });
    } else {
      /* Already in snapshot view — swap which snapshot we're inspecting
         but hold on to the buffered active state so "Back" still lands
         on the buyer's live plan, not the previous snapshot. */
      setSnapshotViewMode((prev) =>
        prev
          ? { ...prev, snapshotId: snap.id, snapshotName: snap.name, createdAt: snap.createdAt }
          : prev,
      );
    }
    /* Restore the buyer's intent into workspace state. */
    setAllocations(new Map(snap.intent.allocations));
    setProposedArrival(new Map(snap.intent.proposedArrival));
    setExtraPOs(snap.intent.extraPOs.map((x) => ({ ...x })));
    setMockEvents(snap.intent.mockEvents.map((m) => ({ ...m })));
    setSimulatedTxns(snap.intent.simulatedTxns.map((s) => ({ ...s })));
    setOverrides(new Map(snap.intent.overrides));
    setSelectedVendorIds(new Set(snap.intent.selectedVendorIds));
    setHorizonDays(snap.intent.horizonDays);
    setHorizonStartDay(snap.intent.horizonStartDay);
    setRecommendationConfig(activeCode, snap.intent.recommendationConfig);
    setLastLoadedSnapshotId(snap.id);
    /* Only surface the banner when the real world drifted since
       save — "no changes" surfaces zero signal and eats screen
       space. Buyer feedback 2026-07-14. */
    if (currentWorld) {
      const diff = diffSnapshotWorld(snap, currentWorld);
      if (diff.hasAnyChange) {
        setRestoreBanner({ snapshotName: snap.name, diff });
      } else {
        setRestoreBanner(null);
      }
    }
  };

  /* Exit snapshot view — restore the buffered pre-snapshot workspace
     state so the buyer lands back on the live plan they had before
     opening the snapshot. Clears every snapshot-affiliated flag. */
  const handleExitSnapshotView = () => {
    if (!snapshotViewMode || !activeCode) return;
    const buffered = snapshotViewMode.bufferedActive;
    setAllocations(new Map(buffered.allocations));
    setProposedArrival(new Map(buffered.proposedArrival));
    setExtraPOs(buffered.extraPOs.map((x) => ({ ...x })));
    setMockEvents(buffered.mockEvents.map((m) => ({ ...m })));
    setSimulatedTxns(buffered.simulatedTxns.map((s) => ({ ...s })));
    setOverrides(new Map(buffered.overrides));
    setSelectedVendorIds(new Set(buffered.selectedVendorIds));
    setHorizonDays(buffered.horizonDays);
    setHorizonStartDay(buffered.horizonStartDay);
    setRecommendationConfig(activeCode, buffered.recommendationConfig);
    setSnapshotViewMode(null);
    setLastLoadedSnapshotId(null);
    setRestoreBanner(null);
  };

  /* Promote the currently-viewed snapshot to the buyer's active plan.
     The snapshot's intent is already loaded, so this just discards the
     buffered pre-snapshot state and drops snapshot-view mode; the
     workspace comes out editable with the snapshot's data as the new
     starting point. */
  const handleMakeSnapshotActive = () => {
    setConfirmMakeActive(false);
    if (!snapshotViewMode) return;
    setSnapshotViewMode(null);
    setLastLoadedSnapshotId(null);
    setRestoreBanner(null);
  };

  /* Units the buyer must source to lift the worst projected ATP back to the
     min floor — the Fulfillment graph's coverage target. Anchored to the
     baseline so it's a stable target, not a moving one as POs are added. */
  const unitsToCover = useMemo(
    () => (item ? Math.max(0, item.minLevel - baseline.worst) : 0),
    [item, baseline.worst],
  );

  /* Planning-period summary for the "Qualified vendors" panel — states, for
     the graph's VISIBLE window, the demand the buyer must cover and how much to
     order, so the quantity isn't a guess (Nophil's planning-phase pain). Built
     fresh here (its own demand sweep over the window); the order target stays
     the graph's bring-to-min gap so the panel and graph never disagree on the
     number. Window = [horizonStartDay, horizonDays] (the same edges the graph
     draws). */
  const planningSummary = useMemo(() => {
    const start = horizonStartDay;
    const end = horizonDays;
    let demand = 0;
    for (const d of effectiveDemand) {
      const day = daysFromToday(d.requiredDate);
      if (day < start || day > end) continue;
      demand += Math.max(0, d.qty - (d.qtyShipped ?? 0) - (d.qtyCancelled ?? 0));
    }
    const periodLabel = start <= 0 ? `Next ${end} days` : `Day +${start} to +${end}`;
    const orderNeeded = item ? Math.max(0, item.minLevel - baseline.worst) : 0;
    return { periodLabel, demand, orderNeeded };
  }, [effectiveDemand, horizonStartDay, horizonDays, item, baseline.worst]);

  /* ── Execute / cart ── */
  const lateCount = useMemo(
    () =>
      needByDay == null
        ? 0
        : proposedPOs.filter((p) => p.arrivalDay > needByDay).length,
    [proposedPOs, needByDay],
  );
  const totalUnits = useMemo(
    () => proposedPOs.reduce((s, p) => s + p.qty, 0),
    [proposedPOs],
  );
  const totalCost = useMemo(
    () =>
      proposedPOs.reduce(
        (s, p) => s + p.qty * effectivePrice(p.unitPrice, p.pricingRules, p.qty),
        0,
      ),
    [proposedPOs],
  );

  const executeToCart = () => {
    if (!item || proposedPOs.length === 0) return;
    for (const p of proposedPOs) {
      const unit = effectivePrice(p.unitPrice, p.pricingRules, p.qty);
      const catalogItem: CatalogItem = {
        id: `${SANDBOX_CART_PREFIX}${item.itemCode}::${p.id}`,
        itemNumber: item.itemCode,
        descriptiveName: item.itemName,
        image: item.itemImage,
        unitPrice: unit,
        currentStock: item.onHand,
        minQuantity: item.minLevel,
        shortageDate: null,
        partnerLocation: p.vendorName,
        category: item.category,
        location: "",
        vendorUOM: item.purchaseUom,
        vendorUOMQty: 1,
        defaultUOM: item.baseUom,
        discount: 0,
      };
      addToCart({
        catalogItem,
        vendorQty: p.qty,
        quantity: p.qty,
        unitPrice: unit,
        discount: 0,
        shipByDate: isoFromDay(Math.max(0, p.arrivalDay - p.leadTimeDays)),
        shipmentMethod: "Standard",
        needByDate: isoFromDay(p.arrivalDay),
        inboundLocation: "Default",
      });
    }
    const n = proposedPOs.length;
    setConfirmOpen(false);
    toast.success(`Added ${n} planned PO${n === 1 ? "" : "s"} to cart`, {
      description: "Review and submit them from the cart.",
      action: { label: "Open cart", onClick: () => navigate("/cart") },
    });
  };


  /* ── Fulfillment-graph handlers ── */
  const toggleVendor = (id: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setAllocation = (id: string, qty: number) => {
    setAllocations((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
    /* Selection follows the quantity — the "Qualified vendors" panel dropped
       its select toggle, so a vendor enters the plan when its qty goes > 0 and
       leaves at 0. proposedPOs + the (parked) Timeline still read
       selectedVendorIds, so keep it in sync here. */
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (qty <= 0) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Tab handlers ── */
  /* ── Add items to the sandbox ──────────────────────────────────────
     The trailing "+" in the tab strip opens the SAME ported Manage-Items
     modal the filter flow uses, but scoped to the sandbox: the selection
     IS the open tabs, so checking an item opens a tab and unchecking
     closes it. Lets a buyer pull more items in without round-tripping out
     to the listing. */
  const [manageOpen, setManageOpen] = useState(false);
  const sandboxItemUniverse = useMemo<PlannerInventoryItem[]>(
    () =>
      PLANNER_ITEMS.map((i) => ({
        code: i.itemCode,
        name: i.itemName,
        category: i.category,
        ownedByMe: i.ownedByMe,
        image: i.itemImage,
        onHand: i.onHand,
        unit: i.baseUom,
        vendor: i.primaryVendor,
      })),
    [],
  );
  const commitSandboxItems = (codes: string[]) => {
    const next = new Set(codes);
    /* Every code checked in this batch that wasn't already open counts as
       "manually added" — that's the signal for the empty-sandbox flow. */
    const previouslyOpen = new Set(openItems);
    const newlyAdded = codes.filter((c) => !previouslyOpen.has(c));
    if (newlyAdded.length > 0) {
      setManuallyAddedCodes((prev) => {
        const merged = new Set(prev);
        newlyAdded.forEach((c) => merged.add(c));
        persistManuallyAdded(merged);
        return merged;
      });
    }
    codes.forEach(openPlannerItem); // idempotent — only newly-checked items take
    openItems.forEach((c) => {
      if (!next.has(c)) closePlannerItem(c);
    });
    /* Closed codes clear their manual-added flag so re-opening later via the
       listing gets the full seeded sandbox back. */
    const closedCodes = openItems.filter((c) => !next.has(c));
    if (closedCodes.length > 0) {
      setManuallyAddedCodes((prev) => {
        const trimmed = new Set(prev);
        closedCodes.forEach((c) => trimmed.delete(c));
        persistManuallyAdded(trimmed);
        return trimmed;
      });
    }
    // If the tab you were viewing got unchecked, leave it — otherwise the
    // route effect would just re-open it. Land on a remaining tab, or back
    // on the listing if the sandbox was cleared entirely.
    if (activeCode && !next.has(activeCode)) {
      if (codes.length) navigate(`/purchase-orders/plan/${codes[0]}`);
      else navigate("/purchase-orders?topTab=demands");
    }
  };

  const goToItem = (code: string) => {
    if (code !== activeCode) navigate(`/purchase-orders/plan/${code}`);
  };
  const handleCloseTab = (code: string) => {
    const fallback = closePlannerItem(code);
    if (code === activeCode) {
      if (fallback) navigate(`/purchase-orders/plan/${fallback}`);
      else navigate("/purchase-orders?topTab=demands");
    }
  };

  /* Back to the Procurement Planning listing — ALWAYS go straight to the demands
     tab (its filters/scope restore from localStorage), regardless of browser
     history, so the back button always lands on the listing table rather than
     wherever the buyer happened to come from. */
  const backToListing = () => {
    navigate("/purchase-orders?topTab=demands");
  };

  /* ── Not-found guard ── */
  if (!item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <Package className="h-10 w-10 text-slate-300" />
        <div>
          <p className="text-base font-semibold text-slate-800">Item not found</p>
          <p className="text-sm text-slate-500">
            {activeCode ? `"${activeCode}" isn't a planning item.` : "No item selected."}
          </p>
        </div>
        <button
          onClick={() => navigate("/purchase-orders?topTab=demands")}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Procurement Planning
        </button>
      </div>
    );
  }

  /* Header pill = coarse where-do-I-stand status (Negative / Positive /
     Overstock) of ATP today vs zero + max. See STATUS_TONE. */
  const sev = STATUS_TONE[stockStatusForAtp(metrics.atp, item.maxLevel)];
  /* Planning surface per item. Classic (two-column) is the surface shown for
     every item. The Timeline (Gantt) variation is gated behind
     SHOW_TIMELINE_VARIATION (hidden per product direction); when re-enabled it
     renders for the first planner item only. */
  const isFirstItem = item.itemCode === PLANNER_ITEMS[0]?.itemCode;

  /* Header "Create purchase orders" CTA — moved up from the old footer and
     styled like the PO detail / partner header's single solid primary button.
     Visually disabled (with a tooltip reason) when it can't proceed. */
  const createDisabledReason =
    proposedPOs.length === 0
      ? "Set a quantity on at least one qualified vendor to build purchase orders."
      : undefined;
  /* Always-on hover hint for the CTA. Late arrivals no longer block the action
     (the old override checkbox is gone) — they surface here as an informational
     heads-up the buyer can act straight through. */
  const createHint = createDisabledReason
    ? createDisabledReason
    : lateCount > 0
      ? `${lateCount} PO${lateCount === 1 ? "" : "s"} arrive${lateCount === 1 ? "s" : ""} after the need-by date`
      : `Add ${proposedPOs.length} PO${proposedPOs.length === 1 ? "" : "s"} ($${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) to your cart.`;
  const createButton = (
    <button
      onClick={() => {
        if (createDisabledReason) return;
        /* Buyer 2026-07-22: when auto is on, this button opens the
           SO-parity review card (autoBreakdownOpen) so the buyer can
           inspect the N POs + hover-math before executing. When only
           manual POs exist, keep the classic confirm-and-commit flow. */
        if (recommendationConfig.trigger !== "off" && autoProposedPOs.length > 0) {
          setAutoBreakdownOpen(true);
        } else {
          setConfirmOpen(true);
        }
      }}
      aria-disabled={!!createDisabledReason}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white transition-opacity 2xl:gap-2 2xl:px-4 2xl:py-2.5 2xl:text-sm ${
        createDisabledReason ? "cursor-not-allowed opacity-40" : "hover:opacity-90"
      }`}
      style={{ backgroundColor: VIOLET }}
    >
      <ShoppingCart className="h-3 w-3 2xl:h-4 2xl:w-4" />
      {proposedPOs.length > 0
        ? `Add ${proposedPOs.length} PO${proposedPOs.length === 1 ? "" : "s"} to cart`
        : "Add to cart"}
      {/* Late-orders indicator removed 2026-07-23 (buyer: "no need to
          show 1 late here inside we are showing and it is fine") — the
          review modal already surfaces the per-row error + resolver
          picker, so a duplicate CTA badge was clutter. */}
    </button>
  );
  /* Same width contract as the PO detail page: 1520px capped, full-bleed
     when the buyer enters full view. */
  const maxWidthClass = "max-w-none";

  /* Horizon control — the 30/60/90 chips and the custom-date picker are ONE
     mutually-exclusive selector, not two independent boxes. A preset reads as
     active only when it matches `horizonDays` exactly; otherwise the custom
     option is the active one (and shows the chosen end date). */
  /* Custom whenever the window isn't a clean today→preset span (i.e. the
     start has moved off today, or the end isn't 30/60/90). */
  const isCustomHorizon =
    horizonStartDay > 0 || !(HORIZON_OPTIONS as readonly number[]).includes(horizonDays);
  /* Local Date for a day-offset (parsed from isoFromDay parts so react-day-
     picker's matchers + the labels don't drift across timezones). */
  const dateFromDayOffset = (day: number): Date => {
    const [y, m, d] = isoFromDay(day).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const horizonStartDate = dateFromDayOffset(horizonStartDay);
  const horizonEndDate = dateFromDayOffset(horizonDays);
  const fmtMonthDay = (dt: Date) => dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const fmtFull = (dt: Date) =>
    dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  /* Label: a "From – To" range once the start has moved; just the end date
     otherwise (a today→date window). */
  const customHorizonLabel =
    horizonStartDay > 0 ? `${fmtMonthDay(horizonStartDate)} – ${fmtFull(horizonEndDate)}` : fmtFull(horizonEndDate);
  /* Selectable window: today → 365 days out (the From can be today; the range
     picker keeps From ≤ To). Built as local Dates to avoid TZ drift. */
  const horizonMinDate = dateFromDayOffset(0);
  const horizonMaxDate = dateFromDayOffset(365);

  /* Transaction Table — the detail ledger, shown in both views, always
     expanded (no accordion). Rendered via a helper so Timeline keeps it
     below the canvas while Classic nests it in the right column. The `key`
     remounts it per item (resets the pager to page 1). */
  // Transaction ledger — shared by the Timeline card and the grid panel.
  const transactionStream = () => (
    <UnifiedTransactionStream
      demandEvents={ledgerDemand}
      incomingEvents={ledgerIncoming}
      predictedIds={predictedTxnIds}
      poByNumber={poByNumber}
      baseUom={item.baseUom}
      startingBalance={item.onHand - item.quarantined}
      atpByDay={atpByDay}
      minLevel={item.minLevel}
      maxLevel={item.maxLevel}
      plannedIncoming={plannedIncomingRows}
      simulatedEvents={simulatedTxns}
      onRemoveSimulated={isSnapshotView ? undefined : removeSimulatedTxn}
      onAddSimulated={isSnapshotView ? undefined : addSimulatedTxn}
      item={item}
      vendors={expandedVendors}
      allVendors={expandedAllVendors}
      deadlineDay={needByDay}
      onPlotVendor={isSnapshotView ? undefined : plotVendorAt}
      highlightDay={hoverDay}
      draftIncoming={draftPOs}
      showDrafts={showDrafts}
      onShowDraftsChange={setShowDrafts}
      onHoverRow={setHoverDay}
      onTxMinWidthChange={handleTxMinWidthChange}
    />
  );
  // Timeline view keeps the transaction table as a self-managed collapsible card.
  const renderTimelineTransactions = () => (
    <SectionCard
      key={`txn-${item.itemCode}`}
      title="Transaction Table"
      subtitle="Shows every event that changes this item's stock. Supply pushes it up, demand pulls it down, and Projected stock shows what's left after each event."
      right={isSnapshotView ? null : <SimulateEntryButton baseUom={item.baseUom} onAdd={addSimulatedTxn} />}
      collapsible
      defaultCollapsed
    >
      {transactionStream()}
    </SectionCard>
  );

  /* Classic-view panels (Partner-detail-style draggable / resizable cards). */
  const PANEL_META: Record<PanelKey, { title: string; subtitle: string }> = {
    vendors: {
      title: "Qualified vendors",
      subtitle:
        "Set a quantity for a vendor to create a PO. It is placed today and arrives after the vendor lead time.",
    },
    graph: {
      title: "Projected stock over time",
      subtitle:
        "The graph shows how this item's stock is projected to drop over time against your minimum and maximum levels. Add vendor orders to close the gap and keep this item from running short.",
    },
    transactions: {
      title: "Transaction table",
      subtitle:
        "Every event that moves this item's stock, in date order. Supply raises the level, demand lowers it, and projected stock shows what remains after each event.",
    },
  };
  /* Header controls per panel (the graph's horizon selector, the table's
     Simulate button). The size toggle + collapse chevron live in DraggablePanel. */
  const panelRight = (key: PanelKey): ReactNode => {
    if (key === "transactions")
      // Add actions (demand · supply · vendor · simulate) now live in the
      // timeline's own header bar (TimelineAddBar), so the panel header is bare.
      return null;
    if (key === "graph")
      return (
        <div className="flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={() => setOverrides(new Map())}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          {/* Horizon selector — ONE control: 30/60/90 quick chips + a custom
              From–To date range, mutually exclusive. */}
          <div className="flex items-center rounded-md border border-slate-200 p-[2px] 2xl:p-0.5">
            {HORIZON_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => {
                  setHorizonStartDay(0);
                  setHorizonDays(h);
                }}
                className={`rounded px-1.5 py-[1px] text-[10.5px] font-medium transition-colors 2xl:px-2 2xl:py-0.5 2xl:text-[11px] ${
                  !isCustomHorizon && horizonDays === h
                    ? "bg-[#EFF6FF] text-[#0A77FF]"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {h}d
              </button>
            ))}
            <span className="mx-0.5 h-3 w-px bg-slate-200 2xl:h-4" aria-hidden />
            <Popover
              open={horizonPickerOpen}
              onOpenChange={(o) => {
                setHorizonPickerOpen(o);
                if (o) setPendingRange({ from: horizonStartDate, to: horizonEndDate });
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Project across a custom date range"
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[10.5px] font-medium transition-colors 2xl:px-2 2xl:py-0.5 2xl:text-[11px] ${
                    isCustomHorizon ? "bg-[#EFF6FF] text-[#0A77FF]" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <CalendarDays
                    className={`h-2.5 w-2.5 2xl:h-3 2xl:w-3 ${isCustomHorizon ? "text-[#0A77FF]" : "text-slate-400"}`}
                  />
                  <span className="whitespace-nowrap tabular-nums">
                    {isCustomHorizon ? customHorizonLabel : "Custom"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                sideOffset={6}
                avoidCollisions
                collisionPadding={12}
                className="w-auto p-0 z-[300]"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-[12px] font-semibold text-slate-700">Custom date range</p>
                  <p className="text-[11px] text-slate-400">
                    {pendingRange?.from && !pendingRange?.to
                      ? "Pick the end date"
                      : "Pick a start date, then an end date"}
                  </p>
                </div>
                <Calendar
                  mode="range"
                  showOutsideDays={false}
                  selected={pendingRange}
                  defaultMonth={pendingRange?.from ?? horizonStartDate}
                  numberOfMonths={2}
                  onSelect={setPendingRange}
                  disabled={[{ before: horizonMinDate }, { after: horizonMaxDate }]}
                  initialFocus
                />
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
                  <span className="text-[11px] tabular-nums text-slate-500">
                    {pendingRange?.from && pendingRange?.to
                      ? `${fmtMonthDay(pendingRange.from)} – ${fmtFull(pendingRange.to)}`
                      : pendingRange?.from
                        ? `${fmtFull(pendingRange.from)} – …`
                        : "No range selected"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHorizonPickerOpen(false)}
                      className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!pendingRange?.from || !pendingRange?.to}
                      onClick={() => {
                        if (!pendingRange?.from || !pendingRange?.to) return;
                        const toIso = (d: Date) =>
                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        const start = Math.max(0, Math.min(364, daysFromToday(toIso(pendingRange.from))));
                        const end = Math.max(start + 1, Math.min(365, daysFromToday(toIso(pendingRange.to))));
                        setHorizonStartDay(start);
                        setHorizonDays(end);
                        setHorizonPickerOpen(false);
                      }}
                      className="rounded-md bg-[#0A77FF] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {/* Auto-supply mode — a compact dropdown to the right of the date
              filters. Non-off modes synthesise ephemeral supply events that
              lift the projected curve back to the picked threshold. Per-item,
              persisted via plannerRecommendationStore. */}
          {activeCode && (() => {
            /* Impact stats — the trigger chip on the closed dropdown
               reflects the COMMITTED config (what's actually on the
               graph). Inside the dropdown the buyer is picking a new
               config; the display, count, and CTAs use the PENDING
               config so nothing bleeds to the graph until commit. */
            const autoCount = autoProposedPOs.length;
            const autoVendors = new Set(autoProposedPOs.map((p) => p.vendorId)).size;
            const autoUnits = autoProposedPOs.reduce((s, p) => s + p.qty, 0);
            /* `committedCfg` = what's live on the graph right now.
               `cfg` = what the dropdown UI is showing (pending edits if
               any, else committed). */
            const committedCfg = recommendationConfig;
            const cfg = pendingConfig ?? committedCfg;
            const isActive = cfg.trigger !== "off";
            /* Trigger-chip label — always driven by COMMITTED config
               (the closed dropdown reflects the current graph state,
               not a staged edit). */
            const triggerChipLabel = committedCfg.trigger === "off"
              ? "Off"
              : committedCfg.trigger === "min"
                ? "Min threshold"
                : committedCfg.trigger === "zero"
                  ? "Below zero"
                  : TRIGGER_LABEL[committedCfg.trigger];
            const triggerTitle = committedCfg.trigger !== "off"
              ? `${triggerChipLabel} — ${autoCount} order${autoCount === 1 ? "" : "s"} across ${autoVendors} vendor${autoVendors === 1 ? "" : "s"}, ${autoUnits} ${item.baseUom}`
              : "Purchase order recommendations — pick which item rule fires";
            /* Staged commit: writes to local `pendingConfig` only.
               Nothing hits the store until the buyer clicks one of
               the two CTAs at the bottom of the dropdown. */
            const applyConfig = (next: RecommendationConfig) =>
              setPendingConfig(next);
            /* Recipe preview text — reads from the pending cfg so the
               "How the recommendation is built" strip mirrors what
               the buyer's about to commit. */
            const triggerReadable =
              cfg.trigger === "off"
                ? "—"
                : cfg.trigger === "zero"
                  ? "zero"
                  : cfg.trigger === "min"
                    ? "minimum"
                    : "maximum";
            const fillReadable =
              cfg.fillTo === "zero"
                ? "zero"
                : cfg.fillTo === "min"
                  ? "minimum"
                  : "maximum";
            /* Commit the pending config to the store. Dropdown close
               is handled by Radix natively (DropdownMenuItem's default
               select behaviour), so we don't touch open state here.
               Buyer 2026-07-19: controlled `open` was desyncing with
               Radix after commit and blocking subsequent clicks on
               the Auto trigger button. Reverted to uncontrolled. */
            const commitPending = () => {
              if (pendingConfig) {
                setRecommendationConfig(activeCode, pendingConfig);
              }
              setPendingConfig(null);
              /* Buyer 2026-07-23: after "See on graph", auto-open the
                 review modal so the full PO breakdown (vendor, qty,
                 dates, late-order resolution) is visible in one shot
                 instead of hidden behind the "Add N POs to cart" CTA.
                 Only fire when the committed config actually produces
                 recommendations — an "off" trigger has nothing to show. */
              const nextTrigger = pendingConfig?.trigger ?? recommendationConfig.trigger;
              if (nextTrigger !== "off") {
                setAutoBreakdownOpen(true);
              }
            };
            return (
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open) {
                    /* Snap pending to currently-committed on open so
                       the buyer starts from what's live. */
                    setPendingConfig(recommendationConfig);
                  } else {
                    /* Any close (outside click, escape, item select
                       — Radix decides) — clear pending; the CTA
                       handlers run their commit BEFORE this fires
                       via DropdownMenuItem's select flow, so a
                       committed value is already in the store. */
                    setPendingConfig(null);
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title={triggerTitle}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold text-white transition-all hover:brightness-105 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 2xl:gap-1.5 2xl:px-2.5 2xl:py-1.5 2xl:text-[11.5px]"
                    style={{
                      backgroundImage: isActive
                        ? "linear-gradient(135deg, #059669 0%, #0EA5A0 45%, #14B8A6 100%)"
                        : "linear-gradient(135deg, #0A77FF 0%, #6D5DFB 55%, #7C3AED 100%)",
                      boxShadow: isActive
                        ? "0 1px 2px 0 rgba(16,185,129,0.35), 0 4px 12px -2px rgba(16,185,129,0.28), inset 0 1px 0 0 rgba(255,255,255,0.18)"
                        : "0 1px 2px 0 rgba(10,119,255,0.35), 0 4px 12px -2px rgba(124,58,237,0.28), inset 0 1px 0 0 rgba(255,255,255,0.18)",
                    }}
                  >
                    <Sparkles className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                    <span className="whitespace-nowrap">
                      Auto: <span>{triggerChipLabel}</span>
                    </span>
                    {isActive && autoCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-white/25 px-1 min-w-[16px] h-3.5 text-[9.5px] font-bold tabular-nums 2xl:px-1.5 2xl:min-w-[18px] 2xl:h-4 2xl:text-[10px]"
                        aria-label={`${autoCount} auto orders`}
                      >
                        {autoCount}
                      </span>
                    )}
                    <ChevronDown className="h-2.5 w-2.5 opacity-80 2xl:h-3 2xl:w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[340px] p-0 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg"
                >
                  {/* Header */}
                  <div className="px-3 pt-2.5 pb-2 border-b border-slate-200/70">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      style={{ letterSpacing: "0.06em" }}
                    >
                      Purchase order recommendations
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-slate-500">
                      Choose how a purchase order is suggested for this item.
                    </p>
                  </div>

                  {/* Two-row radio list —
                        Row 1: this item's assigned rule (from the item
                               library). Read-only wording; source-of-truth
                               lives on the item card.
                        Row 2: Custom rule — expands to show trigger +
                               refill selectors when picked.  */}
                  {(() => {
                    const itemRule = getItemPORecommendationRule(item);
                    const itemRuleMeta = PO_RECOMMENDATION_RULES[itemRule];
                    const itemRuleCfg = ITEM_RULE_TO_CONFIG[itemRule];
                    const followingItemRule =
                      cfg.source === "item-master" &&
                      cfg.trigger === itemRuleCfg.trigger &&
                      cfg.fillTo === itemRuleCfg.fillTo;
                    const usingCustom = cfg.source === "manual" && isActive;
                    return (
                      <div className="py-1.5">
                        {/* Row 1 — follow item-master rules (default).
                            Buyer 2026-07-19: mode 1 must communicate it
                            comes from the item card AND surface what
                            the rule actually is. Title is constant;
                            subtitle spells out the concrete trigger +
                            refill from the item's own config so the
                            buyer doesn't have to cross-reference the
                            item card. Uses the same TRIGGER_LABEL /
                            FILL_LABEL as the Auto trigger chip below,
                            so the two surfaces speak the same words. */}
                        <RecoOptionRow
                          selected={followingItemRule || (!isActive && itemRule === "disable")}
                          onSelect={() => applyConfig(itemRuleCfg)}
                          title="Follow the item master rules"
                          subtitle={
                            itemRule === "disable" ? (
                              <span className="text-slate-500">
                                This item has automatic recommendations disabled — you plot POs yourself.
                              </span>
                            ) : (
                              /* Informational — what the rules actually
                                 are for this item (buyer 2026-07-22
                                 "with an informational showing what they
                                 are"). Trigger + refill labels plus the
                                 concrete threshold numbers so the buyer
                                 doesn't have to cross-reference the item
                                 card. */
                              <span className="text-slate-500">
                                <span className="font-medium text-slate-700">
                                  Trigger {TRIGGER_LABEL[itemRuleCfg.trigger].toLowerCase()}
                                </span>
                                {itemRuleCfg.trigger === "min" && ` (${item.minLevel} ${item.baseUom})`}
                                {itemRuleCfg.trigger === "max" && ` (${item.maxLevel} ${item.baseUom})`}
                                {" · "}
                                <span className="font-medium text-slate-700">
                                  Refill to {FILL_LABEL[itemRuleCfg.fillTo].toLowerCase()}
                                </span>
                                {itemRuleCfg.fillTo === "min" && ` (${item.minLevel} ${item.baseUom})`}
                                {itemRuleCfg.fillTo === "max" && ` (${item.maxLevel} ${item.baseUom})`}
                              </span>
                            )
                          }
                        />
                        {/* Row 2 — override with custom rules. Trigger
                            + fillTo picker expands inline when picked. */}
                        <RecoOptionRow
                          selected={usingCustom}
                          onSelect={() => {
                            const nextTrigger: RecommendationTrigger =
                              cfg.trigger === "off" ? "min" : cfg.trigger;
                            applyConfig({
                              source: "manual",
                              trigger: nextTrigger,
                              fillTo: coerceFillTo(nextTrigger, cfg.fillTo),
                            });
                          }}
                          title="Override with custom rules"
                          subtitle="Pick your own trigger and refill amount."
                        >
                          {usingCustom && (
                            <div className="mt-2 space-y-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                              <div>
                                <div className="mb-1 text-[10px] font-semibold text-slate-500">
                                  Trigger when stock drops
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {CUSTOM_TRIGGER_OPTIONS.map((t) => {
                                    const active = cfg.trigger === t.value;
                                    return (
                                      <button
                                        key={t.value}
                                        type="button"
                                        title={t.hint}
                                        onClick={() =>
                                          applyConfig({
                                            source: "manual",
                                            trigger: t.value,
                                            /* Coerce fillTo when trigger changes so the
                                               pair stays coherent — below-min can't
                                               refill to zero, below-max must refill to
                                               max only. */
                                            fillTo: coerceFillTo(t.value, cfg.fillTo),
                                          })
                                        }
                                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                          active
                                            ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                        }`}
                                      >
                                        {t.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-[10px] font-semibold text-slate-500">
                                  Refill stock up to
                                </div>
                                {(() => {
                                  /* Filter refill choices by trigger so the pair
                                     always describes a coherent rule (Eli 2026-07-19).
                                     E.g. trigger "below min" hides "zero" — refilling
                                     to zero from a below-min dip leaves you still short. */
                                  const validFills = fillOptionsFor(cfg.trigger);
                                  const visible = CUSTOM_FILL_OPTIONS.filter((f) =>
                                    validFills.includes(f.value),
                                  );
                                  const gridCols =
                                    visible.length === 3
                                      ? "grid-cols-3"
                                      : visible.length === 2
                                        ? "grid-cols-2"
                                        : "grid-cols-1";
                                  return (
                                    <div className={`grid ${gridCols} gap-1`}>
                                      {visible.map((f) => {
                                        const active = cfg.fillTo === f.value;
                                        return (
                                          <button
                                            key={f.value}
                                            type="button"
                                            title={f.hint}
                                            onClick={() =>
                                              applyConfig({
                                                source: "manual",
                                                trigger:
                                                  cfg.trigger === "off" ? "min" : cfg.trigger,
                                                fillTo: f.value,
                                              })
                                            }
                                            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                              active
                                                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                            }`}
                                          >
                                            {f.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </RecoOptionRow>
                      </div>
                    );
                  })()}

                  {/* Recipe preview — one line, the essential shape of
                      the rule. Buyer 2026-07-19: "no need to show this
                      much text — a single important text". MOQ / order-
                      multiples were implementation detail noise; the
                      trigger↔refill pair is what the buyer actually
                      needs to see before committing. */}
                  {isActive && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[10.5px] leading-snug text-slate-600">
                      Fires when stock drops below{" "}
                      <span className="font-semibold text-slate-800">{triggerReadable}</span>
                      , refills up to{" "}
                      <span className="font-semibold text-slate-800">{fillReadable}</span>.
                    </div>
                  )}

                  {/* Single CTA — "See on graph" commits the rules and
                      closes the dropdown; recommendations plot on the
                      graph. Review + execute happens from the workspace's
                      "Add N POs to cart" button (buyer 2026-07-22:
                      "see graph needs to land on the graph. The modal
                      opens the way it usually opens by clicking on the
                      cart button"). No separate "See planned purchase
                      orders" — that checkout path was removed. */}
                  {isActive && (
                    <div className="border-t border-slate-100 px-3 py-2">
                      <DropdownMenuItem
                        onSelect={commitPending}
                        className="group p-0 focus:bg-transparent data-[highlighted]:bg-transparent cursor-pointer"
                      >
                        <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#0A77FF] px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors group-data-[highlighted]:bg-[#0866DE]">
                          See on graph
                        </div>
                      </DropdownMenuItem>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
          {/* Snapshots — compact dropdown pattern that mirrors the
              Auto: button. Buyer feedback 2026-07-14: the side
              drawer was too heavy; wanted the same dropdown vibe.
              "Take snapshot" stays as a separate one-click action.
              In snapshot view it's disabled — you can't snapshot a
              snapshot from a static view (buyer feedback 2026-07-20). */}
          {activeCode && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={isSnapshotView}
                title={
                  isSnapshotView
                    ? "You're viewing a snapshot — return to your active plan to take a new one"
                    : "Save a snapshot of the current plan"
                }
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 2xl:px-2.5 2xl:py-1.5 2xl:text-[11.5px] ${
                  snapshotCapturedFlash
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 scale-[1.03]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {snapshotCapturedFlash ? (
                  <CheckCircle2 className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                ) : (
                  <Camera className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                )}
                {snapshotCapturedFlash ? "Snapshot saved" : "Take snapshot"}
              </button>
              <PlannerSnapshotsDrawer
                snapshots={snapshots}
                itemCode={activeCode}
                loadedSnapshotId={lastLoadedSnapshotId}
                onOpenSnapshot={handleOpenSnapshot}
                onCompare={(snaps) => setCompareSnapshots(snaps)}
                trigger={
                  <button
                    type="button"
                    title="Open snapshots list"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 2xl:px-2.5 2xl:py-1.5 2xl:text-[11.5px]"
                  >
                    Snapshots
                    {snapshots.length > 0 && (
                      <span
                        className={`grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9.5px] font-bold tabular-nums transition-all duration-300 2xl:h-4 2xl:min-w-[16px] 2xl:text-[10px] ${
                          snapshotCapturedFlash
                            ? "bg-emerald-500 text-white scale-125"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {snapshots.length}
                      </span>
                    )}
                    <ChevronDown className="h-2.5 w-2.5 opacity-70 2xl:h-3 2xl:w-3" />
                  </button>
                }
              />
            </div>
          )}
          {/* Auto-supply breakdown — centralized modal. Trigger lives inside
              the selected option in the Auto: dropdown ("View details").
              Shows impact stats, edge-case advisories, and the per-vendor
              rollup all in one place so buyers can see WHY auto picked the
              orders it did without hopping between surfaces. */}
          {activeCode && (() => {
            const totalOrders = autoProposedPOs.length;
            const totalVendors = new Set(autoProposedPOs.map((p) => p.vendorId)).size;
            const totalQty = autoProposedPOs.reduce((s, p) => s + p.qty, 0);
            const totalCost = autoProposedPOs.reduce((s, p) => s + p.qty * p.unitPrice, 0);
            type VendorRoll = {
              vendorId: string;
              vendorName: string;
              orders: number;
              qty: number;
              cost: number;
              arrivalMin: number;
              arrivalMax: number;
              leadTimeDays: number;
              unitPrice: number;
            };
            const rollMap = new Map<string, VendorRoll>();
            for (const p of autoProposedPOs) {
              const cur = rollMap.get(p.vendorId);
              const cost = p.qty * p.unitPrice;
              if (cur) {
                cur.orders += 1;
                cur.qty += p.qty;
                cur.cost += cost;
                if (p.arrivalDay < cur.arrivalMin) cur.arrivalMin = p.arrivalDay;
                if (p.arrivalDay > cur.arrivalMax) cur.arrivalMax = p.arrivalDay;
              } else {
                rollMap.set(p.vendorId, {
                  vendorId: p.vendorId,
                  vendorName: p.vendorName,
                  orders: 1,
                  qty: p.qty,
                  cost,
                  arrivalMin: p.arrivalDay,
                  arrivalMax: p.arrivalDay,
                  leadTimeDays: p.leadTimeDays,
                  unitPrice: p.unitPrice,
                });
              }
            }
            const rows = Array.from(rollMap.values()).sort((a, b) => b.cost - a.cost);
            const modeLabel =
              recommendationConfig.trigger === "off"
                ? "Off"
                : recommendationConfig.trigger === "min"
                  ? "Min threshold"
                  : recommendationConfig.trigger === "zero"
                    ? "Below zero"
                    : TRIGGER_LABEL[recommendationConfig.trigger];
            const hasAdvisory =
              autoIssues.overOrder > 0 || autoIssues.splitDays > 0 || autoIssues.lateCount > 0;
            /* AGGREGATE PER VENDOR: the auto-recommender emits one PO per
               shortfall day, so a single vendor covering many shortfalls
               would previously render as many near-identical cards. Buyer
               feedback: "too many acme". Collapse to one card per vendor
               with the summed qty + cost, an order-day range and an
               arrival-day range, plus a × N chip showing how many
               shortfalls were consolidated. Underlying `autoProposedPOs`
               list is untouched — Add to cart still pushes every original
               PO record. */
            type MergedPO = {
              key: string;
              vendorId: string;
              vendorName: string;
              orderDayMin: number;
              orderDayMax: number;
              arrivalDayMin: number;
              arrivalDayMax: number;
              unitPrice: number;
              leadTimeDays: number;
              qty: number;
              count: number;
              anyLate: boolean;
              /* First-seen decision trace for this vendor. When a
                 vendor covers multiple shortfalls the trace snapshots
                 the first event's Step-1 gate — candidates and outcome
                 are typically stable across events for the same vendor
                 pool. Undefined for manual POs. */
              autoDecision?: AutoDecision;
            };
            const mergedMap = new Map<string, MergedPO>();
            for (const p of autoProposedPOs) {
              /* Late = vendor's lead time couldn't hit the shortfall day
                 the auto-recommender was trying to cover. Falls back to
                 the buyer's Need-by anchor (if set) for manual POs that
                 don't carry a shortfallDay. Prior to 2026-07-23 this
                 relied solely on the anchor, which is null by default —
                 so late orders never surfaced unless the buyer manually
                 dropped a Need-by line. Now the case is visible on every
                 item in every auto mode out of the box. */
              const late =
                p.shortfallDay != null
                  ? p.arrivalDay > p.shortfallDay
                  : needByDay != null && p.arrivalDay > needByDay;
              const cur = mergedMap.get(p.vendorId);
              if (cur) {
                cur.qty += p.qty;
                cur.count += 1;
                if (p.orderDay < cur.orderDayMin) cur.orderDayMin = p.orderDay;
                if (p.orderDay > cur.orderDayMax) cur.orderDayMax = p.orderDay;
                if (p.arrivalDay < cur.arrivalDayMin) cur.arrivalDayMin = p.arrivalDay;
                if (p.arrivalDay > cur.arrivalDayMax) cur.arrivalDayMax = p.arrivalDay;
                if (late) cur.anyLate = true;
                /* Upgrade the trace when a later event surfaced a
                   "worse" outcome (late-fallback beats split beats
                   priority-of-many beats single-solve) so the reveal
                   flags the most-informative case. */
                if (p.autoDecision && cur.autoDecision) {
                  const rank = (o: AutoDecision["outcome"]) =>
                    o === "late-fallback"
                      ? 3
                      : o === "split-across-vendors"
                        ? 2
                        : o === "highest-priority-of-many"
                          ? 1
                          : 0;
                  if (rank(p.autoDecision.outcome) > rank(cur.autoDecision.outcome)) {
                    cur.autoDecision = p.autoDecision;
                  }
                }
              } else {
                mergedMap.set(p.vendorId, {
                  key: p.vendorId,
                  vendorId: p.vendorId,
                  vendorName: p.vendorName,
                  orderDayMin: p.orderDay,
                  orderDayMax: p.orderDay,
                  arrivalDayMin: p.arrivalDay,
                  arrivalDayMax: p.arrivalDay,
                  unitPrice: p.unitPrice,
                  leadTimeDays: p.leadTimeDays,
                  qty: p.qty,
                  count: 1,
                  anyLate: late,
                  autoDecision: p.autoDecision,
                });
              }
            }
            /* Cheapest first — same sort as the vendor-panel default. */
            const orderedPOs = [...mergedMap.values()].sort((a, b) => a.orderDayMin - b.orderDayMin);
            const meetsMin = totalQty >= item.minLevel;
            /* Buyer 2026-08-03: "we don't need to show this modal" when
               there's nothing to plot. Suppress the dialog entirely when
               the auto-recommender produced zero POs — the buyer stays on
               the graph. */
            if (totalOrders === 0) return null;
            return (
              <Dialog open={autoBreakdownOpen} onOpenChange={setAutoBreakdownOpen}>
                <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden bg-white">
                  {/* Header — icon chip + title. Dialog's built-in X close
                      sits top-right. Subtitle removed 2026-07-23 (buyer:
                      "way too much clutter"). */}
                  {/* Header — tightened 2026-07-23 (buyer: "this needs
                      improvements"). Compact icon chip, direct title
                      (no "Based on your rules" preamble), and a subtle
                      rule-mode chip on the same line so the buyer sees
                      WHAT drove the recommendation without extra copy. */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex items-center justify-center shrink-0 rounded-md"
                        style={{ width: 28, height: 28, backgroundColor: "#ECFDF5", color: "#059669" }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                        <DialogTitle style={{ fontSize: 15, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                          {totalOrders === 0
                            ? "Nothing to plot right now"
                            : `Review ${totalOrders} PO${totalOrders === 1 ? "" : "s"}`}
                        </DialogTitle>
                        {totalOrders > 0 && recommendationConfig.trigger !== "off" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600"
                            title="The auto-recommender rule that produced these POs"
                          >
                            {modeLabel} → {FILL_LABEL[recommendationConfig.fillTo].toLowerCase()}
                          </span>
                        )}
                        <DialogDescription className="sr-only">
                          {modeLabel}. Review each proposed purchase order below.
                        </DialogDescription>
                      </div>
                    </div>
                  </div>
                  {/* Body — scrollable */}
                  <div className="max-h-[560px] overflow-y-auto px-5 pb-4 flex flex-col gap-3">
                    {/* Item context card */}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200/70 p-3">
                      {item.itemImage ? (
                        <img
                          src={item.itemImage}
                          alt={item.itemName}
                          className="shrink-0 rounded-md object-cover"
                          style={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center shrink-0 rounded-md bg-slate-100 text-slate-500"
                          style={{ width: 40, height: 40 }}
                        >
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-slate-900">{item.itemName}</div>
                        <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
                          {item.itemCode}
                          {item.category ? ` · ${item.category}` : ""}
                        </div>
                      </div>
                    </div>
                    {totalOrders === 0 ? (
                      <div
                        className="flex items-start gap-2 rounded-lg px-3 py-2.5"
                        style={{ backgroundColor: "#F8FAFC", border: "1px solid hsl(var(--border) / 0.7)" }}
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-[12.5px] leading-snug text-slate-600">
                          No dips need covering right now. The mode stays on and will add orders if projected stock drops.
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Advisories — declutter pass 2026-07-23. The
                            always-on emerald "meets minimum" ribbon was
                            removed (buyer: "way too much clutter"); the
                            total footer already communicates coverage.
                            MOQ overshoot + split rendered as compact
                            single-line chip rows (icon + text, one line);
                            the late-orders block stays as a full block
                            because it carries interactive bulk actions. */}
                        {!meetsMin && (
                          <div
                            className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                            style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#B45309" }} />
                            <span className="text-[11.5px] leading-snug" style={{ color: "#78350F" }}>
                              Adds <span className="font-semibold">{totalQty.toLocaleString()} {item.baseUom}</span> — still short of minimum ({item.minLevel.toLocaleString()} {item.baseUom}).
                            </span>
                          </div>
                        )}
                        {autoIssues.overOrder > 0 && (
                          <div
                            className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                            style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}
                            title={
                              autoIssues.overOrderVendors.length > 0
                                ? `Driven by ${autoIssues.overOrderVendors.join(", ")}`
                                : undefined
                            }
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#B45309" }} />
                            <span className="text-[11.5px] leading-snug truncate" style={{ color: "#78350F" }}>
                              <span className="font-semibold">+{autoIssues.overOrder} {item.baseUom}</span> above need to meet vendor MOQ.
                            </span>
                          </div>
                        )}
                        {autoIssues.splitDays > 0 && (
                          <div
                            className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                            style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#1D4ED8" }} />
                            <span className="text-[11.5px] leading-snug" style={{ color: "#1E3A8A" }}>
                              <span className="font-semibold">{autoIssues.splitDays}</span> {autoIssues.splitDays === 1 ? "shortfall" : "shortfalls"} split across vendors.
                            </span>
                          </div>
                        )}
                        {(() => {
                          /* Sequential resolution strip (Eli 2026-07-30):
                             when auto can't find a vendor to hit the first
                             date, walk the buyer through the unresolvable
                             POs one at a time. Curve re-projects on every
                             resolution — so accepting soonest for #1 may
                             auto-solve #2/3/etc. Two batch actions cover
                             the "just get it over with" path. */
                          const lateCards = orderedPOs.filter((p) => p.anyLate);
                          if (lateCards.length === 0) return null;
                          const unresolvedLate = lateCards.filter(
                            (p) => lateResolutions[p.vendorId] !== "soonest",
                          );
                          const resolvedCount = lateCards.length - unresolvedLate.length;
                          const totalLate = lateCards.length;
                          const currentStep = resolvedCount + 1;
                          const nextVendorName = unresolvedLate[0]?.vendorName ?? null;
                          const allResolved = unresolvedLate.length === 0;
                          const applyAllSoonest = () => {
                            /* Eli's Option B applied across every late card.
                               For each card whose vendor isn't already the
                               fastest available, materialize replacements
                               into extraPOs pointing at the fastest vendor
                               at their lead time — that's the "swap to the
                               vendor who can supply by the soonest possible
                               date" behavior. Cards already at the fastest
                               vendor just get the flag flip so the display
                               reflects the acceptance. */
                            const fastestVendor = [...expandedVendors].sort(
                              (a, b) => {
                                const la = a.leadTimeDays ?? 0;
                                const lb = b.leadTimeDays ?? 0;
                                if (la !== lb) return la - lb;
                                return a.rank - b.rank;
                              },
                            )[0];
                            const fastestLead = fastestVendor?.leadTimeDays ?? 0;
                            const idsToMark = new Set<string>();
                            const newExtras: {
                              id: string;
                              vendorId: string;
                              qty: number;
                              arrivalDay: number;
                            }[] = [];
                            const vendorIdsToSelect: string[] = [];
                            const flagOnlyVendorIds: string[] = [];
                            for (const card of lateCards) {
                              const currentVendor = expandedVendors.find(
                                (v) => v.vendorId === card.vendorId,
                              );
                              const currentLead = currentVendor?.leadTimeDays ?? 0;
                              const swap =
                                !!fastestVendor &&
                                fastestVendor.vendorId !== card.vendorId &&
                                fastestLead < currentLead;
                              if (!swap) {
                                flagOnlyVendorIds.push(card.vendorId);
                                continue;
                              }
                              const rawsForCard = autoProposedPOs.filter(
                                (raw) =>
                                  raw.vendorId === card.vendorId &&
                                  raw.shortfallDay != null &&
                                  raw.arrivalDay > raw.shortfallDay,
                              );
                              for (const raw of rawsForCard) {
                                idsToMark.add(raw.id);
                                newExtras.push({
                                  id: `xpo-${extraSeq.current++}`,
                                  vendorId: fastestVendor!.vendorId,
                                  qty: raw.qty,
                                  arrivalDay: fastestLead,
                                });
                              }
                              vendorIdsToSelect.push(fastestVendor!.vendorId);
                            }
                            if (idsToMark.size > 0) {
                              setMaterializedAutoIds((prev) => {
                                const next = new Set(prev);
                                for (const id of idsToMark) next.add(id);
                                return next;
                              });
                              setExtraPOs((prev) => [...prev, ...newExtras]);
                              setSelectedVendorIds((prev) => {
                                const next = new Set(prev);
                                for (const id of vendorIdsToSelect) next.add(id);
                                return next;
                              });
                            }
                            if (flagOnlyVendorIds.length > 0) {
                              setLateResolutions((prev) => {
                                const next = { ...prev };
                                for (const id of flagOnlyVendorIds)
                                  next[id] = "soonest";
                                return next;
                              });
                            }
                          };
                          const applyAllForce = () => {
                            /* Force every late auto PO at its optimal need
                               date — ignore vendor lead time, plot on the
                               shortfall day. Eli 2026-07-30: "I get that
                               the PO is overriding the lead time, I don't
                               care, put it in." Materializes each into
                               extraPOs so the projection recomputes with
                               the forced dates. Does NOT open the wizard
                               (that's the individual per-card path). */
                            const lateVendorSet = new Set(
                              lateCards.map((p) => p.vendorId),
                            );
                            const rawsToForce = autoProposedPOs.filter((raw) =>
                              lateVendorSet.has(raw.vendorId) &&
                              raw.shortfallDay != null &&
                              raw.arrivalDay > raw.shortfallDay,
                            );
                            if (rawsToForce.length === 0) return;
                            const idsToMark = new Set<string>();
                            const newExtras: {
                              id: string;
                              vendorId: string;
                              qty: number;
                              arrivalDay: number;
                            }[] = [];
                            const vendorIdsToSelect: string[] = [];
                            for (const raw of rawsToForce) {
                              idsToMark.add(raw.id);
                              newExtras.push({
                                id: `xpo-${extraSeq.current++}`,
                                vendorId: raw.vendorId,
                                qty: raw.qty,
                                arrivalDay: raw.shortfallDay ?? raw.arrivalDay,
                              });
                              vendorIdsToSelect.push(raw.vendorId);
                            }
                            setMaterializedAutoIds((prev) => {
                              const next = new Set(prev);
                              for (const id of idsToMark) next.add(id);
                              return next;
                            });
                            setExtraPOs((prev) => [...prev, ...newExtras]);
                            setSelectedVendorIds((prev) => {
                              const next = new Set(prev);
                              for (const id of vendorIdsToSelect) next.add(id);
                              return next;
                            });
                          };
                          /* Strip flips from amber (warning) to emerald
                             (success) once every late PO has a
                             resolution — buyer 2026-08-03: an all-
                             resolved strip in warning colour reads as
                             an unresolved error. Icon swaps to Check
                             and the copy tightens up. */
                          const stripBg = allResolved ? "#ECFDF5" : "#FEF7EC";
                          const stripBorder = allResolved ? "#A7F3D0" : "#F9D89B";
                          const stripIconColor = allResolved ? "#047857" : "#B45309";
                          const stripTitleColor = allResolved ? "#065F46" : "#78350F";
                          const stripSubColor = allResolved ? "#047857" : "#92400E";
                          return (
                            <div
                              className="rounded-md p-2.5 space-y-2"
                              style={{
                                backgroundColor: stripBg,
                                border: `1px solid ${stripBorder}`,
                              }}
                            >
                              <div className="flex items-start gap-2">
                                {allResolved ? (
                                  <Check
                                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                                    style={{ color: stripIconColor }}
                                    strokeWidth={2.5}
                                  />
                                ) : (
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                                    style={{ color: stripIconColor }}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-[11.5px] font-semibold"
                                    style={{ color: stripTitleColor }}
                                  >
                                    {allResolved ? (
                                      <>All {totalLate} late {totalLate === 1 ? "PO" : "POs"} resolved</>
                                    ) : (
                                      <>
                                        Step {currentStep} of {totalLate} — resolve{" "}
                                        <span className="font-bold">{nextVendorName}</span>
                                      </>
                                    )}
                                  </div>
                                  <div
                                    className="mt-0.5 text-[10.5px] leading-snug"
                                    style={{ color: stripSubColor }}
                                  >
                                    {allResolved
                                      ? "Every late PO shifted to its vendor's soonest date. Review the cards below and add to cart."
                                      : totalLate === 1
                                        ? "No vendor can hit the first date. Use the actions on the card below to resolve it."
                                        : "No vendor can hit the first date. Pick per-card below, or apply one of the batch actions."}
                                  </div>
                                </div>
                              </div>
                              {/* Batch "Apply all" actions only make sense
                                  when there are multiple late cards. With
                                  a single card the buyer would just use
                                  the per-card Accept-soonest / Force-it
                                  buttons on the row itself, so hide them
                                  (buyer 2026-08-03: "do we need to show
                                  this? When you are doing one by one on
                                  each vendor I believe this is
                                  redundant"). */}
                              {!allResolved && totalLate > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={applyAllSoonest}
                                    title="Accept every late vendor's soonest possible arrival."
                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-[#0A77FF] text-white hover:brightness-105 transition-all shadow-sm"
                                  >
                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                    Apply all — Accept soonest
                                  </button>
                                  <button
                                    type="button"
                                    onClick={applyAllForce}
                                    title="Ignore lead times and plot every late PO on its optimal need date."
                                    className="inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-medium border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                                  >
                                    Apply all — Force at optimal
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Per-PO cards — one card per proposed order, sorted by
                            order day. Left accent = order status (blue on time,
                            red late). Wrapped in an IIFE so we can compute the
                            sequential-resolution cursor once (`nextVendorId`)
                            and highlight the current "next up" late card. */}
                        {(() => {
                          const nextVendorId = orderedPOs.find(
                            (p) => p.anyLate && lateResolutions[p.vendorId] !== "soonest",
                          )?.vendorId ?? null;
                          const renderedKeys = new Set(orderedPOs.map((p) => p.key));
                          const phantomResolved = Object.entries(resolvedByKey).filter(
                            ([key]) => !renderedKeys.has(key),
                          );
                          const mainCards = orderedPOs.map((p) => {
                          const orderMinDate = dateFromDayOffset(p.orderDayMin);
                          const orderMaxDate = dateFromDayOffset(p.orderDayMax);
                          const late = p.anyLate;
                          /* Late resolution — "soonest" means the buyer
                             accepted the vendor's actual earliest
                             arrival (orderDay + leadTime); "force"
                             (default, absent from the map) keeps the
                             requested arrival and the vendor will
                             simply be late. */
                          const lateMode: "force" | "soonest" =
                            late && lateResolutions[p.vendorId] === "soonest" ? "soonest" : "force";
                          const isNextInQueue =
                            late && lateMode === "force" && p.vendorId === nextVendorId;
                          /* Effective arrival displayed in the row:
                              · force → the buyer's requested date
                                        (p.arrivalDayMin/Max)
                              · soonest → orderDay + leadTime (the
                                          vendor's realistic arrival) */
                          const effArrivalMin = lateMode === "soonest"
                            ? p.orderDayMin + p.leadTimeDays
                            : p.arrivalDayMin;
                          const effArrivalMax = lateMode === "soonest"
                            ? p.orderDayMax + p.leadTimeDays
                            : p.arrivalDayMax;
                          const arrivalMinDate = dateFromDayOffset(effArrivalMin);
                          const arrivalMaxDate = dateFromDayOffset(effArrivalMax);
                          /* Order label: "today, Jul 9" if it opens today,
                             otherwise plain Month-Day; range if multi-day. */
                          const orderRange = p.orderDayMin === p.orderDayMax
                            ? (p.orderDayMin === 0
                                ? `today, ${fmtMonthDay(orderMinDate)}`
                                : fmtMonthDay(orderMinDate))
                            : `${fmtMonthDay(orderMinDate)} – ${fmtMonthDay(orderMaxDate)}`;
                          const arrivalRange = effArrivalMin === effArrivalMax
                            ? fmtMonthDay(arrivalMinDate)
                            : `${fmtMonthDay(arrivalMinDate)} – ${fmtMonthDay(arrivalMaxDate)}`;
                          const rowCost = p.qty * p.unitPrice;

                          /* Resolution-mode compute + handlers — hoisted
                             above the render so a picker-open card can
                             short-circuit to a distinct resolution panel
                             rather than nesting the picker inside the
                             vendor card. Buyer 2026-07-31: nesting the
                             picker read as "part of Acme's card" even
                             when the buyer was actively selecting a
                             different vendor. */
                          const rawsForCard = late
                            ? autoProposedPOs.filter(
                                (raw) =>
                                  raw.vendorId === p.vendorId &&
                                  raw.shortfallDay != null &&
                                  raw.arrivalDay > raw.shortfallDay,
                              )
                            : [];
                          const earliestShortfall = rawsForCard.length
                            ? Math.min(
                                ...rawsForCard.map(
                                  (r) => r.shortfallDay ?? r.arrivalDay,
                                ),
                              )
                            : p.arrivalDayMin;
                          const acceptCandidates = late
                            ? [...expandedVendors]
                                .map((v) => {
                                  const lead = v.leadTimeDays ?? 0;
                                  return {
                                    vendorId: v.vendorId,
                                    vendorName: v.vendorName,
                                    rank: v.rank,
                                    leadTimeDays: lead,
                                    arrivalDay: lead,
                                    daysLate: Math.max(
                                      0,
                                      lead - earliestShortfall,
                                    ),
                                  };
                                })
                                .sort((a, b) => {
                                  if (a.leadTimeDays !== b.leadTimeDays)
                                    return a.leadTimeDays - b.leadTimeDays;
                                  return a.rank - b.rank;
                                })
                            : [];
                          const recommendedVendorId =
                            acceptCandidates[0]?.vendorId ?? p.vendorId;
                          const shortfallLabel = fmtMonthDay(
                            dateFromDayOffset(earliestShortfall),
                          );
                          const isEditingAccept =
                            acceptEditingKey === p.key && acceptForm != null;
                          const isEditingForce =
                            forceEditingKey === p.key && forceForm != null;
                          const resolvedSummary = resolvedByKey[p.key];
                          const isResolutionMode =
                            late && (isEditingAccept || isEditingForce || !!resolvedSummary);

                          const openAcceptEditor = () => {
                            setForceEditingKey(null);
                            setForceForm(null);
                            setAcceptEditingKey(p.key);
                            setAcceptForm({ vendorId: recommendedVendorId });
                          };
                          const cancelAcceptEditor = () => {
                            setAcceptEditingKey(null);
                            setAcceptForm(null);
                          };
                          const confirmAcceptEditor = () => {
                            if (!acceptForm) {
                              cancelAcceptEditor();
                              return;
                            }
                            const picked = expandedVendors.find(
                              (v) => v.vendorId === acceptForm.vendorId,
                            );
                            if (!picked) {
                              cancelAcceptEditor();
                              return;
                            }
                            const pickedLead = picked.leadTimeDays ?? 0;
                            /* Snapshot the before→after diff for the
                               resolved view. Fires for both the
                               same-vendor "accept soonest" and the
                               different-vendor swap branches below. */
                            setResolvedByKey((prev) => ({
                              ...prev,
                              [p.key]: {
                                mode: "accept",
                                originalVendorId: p.vendorId,
                                originalVendorName: p.vendorName,
                                originalLeadTimeDays: p.leadTimeDays,
                                /* MergedPO has arrivalDayMin/Max (a
                                   range across the raw auto-proposed
                                   POs it aggregates), not a single
                                   `arrivalDay`. Use the max so the
                                   before value reflects the latest
                                   currently-scheduled arrival for the
                                   buyer to compare against. */
                                originalArrivalDay: p.arrivalDayMax,
                                originalQty: p.qty,
                                originalUnitPrice: p.unitPrice,
                                shortfallDay: earliestShortfall,
                                newVendorName: picked.vendorName,
                                newLeadTimeDays: pickedLead,
                                newArrivalDay: pickedLead,
                                newQty: p.qty,
                              },
                            }));
                            if (picked.vendorId === p.vendorId) {
                              setLateResolutions((prev) => ({
                                ...prev,
                                [p.vendorId]: "soonest",
                              }));
                              /* Close the editor but leave the resolved
                                 summary in place — the resolver card
                                 re-renders in "resolved" mode. */
                              setAcceptEditingKey(null);
                              setAcceptForm(null);
                              return;
                            }
                            if (rawsForCard.length === 0) {
                              cancelAcceptEditor();
                              return;
                            }
                            const idsToMark = new Set<string>();
                            const newExtras: {
                              id: string;
                              vendorId: string;
                              qty: number;
                              arrivalDay: number;
                            }[] = [];
                            for (const raw of rawsForCard) {
                              idsToMark.add(raw.id);
                              newExtras.push({
                                id: `xpo-${extraSeq.current++}`,
                                vendorId: picked.vendorId,
                                qty: raw.qty,
                                arrivalDay: pickedLead,
                              });
                            }
                            setMaterializedAutoIds((prev) => {
                              const next = new Set(prev);
                              for (const id of idsToMark) next.add(id);
                              return next;
                            });
                            setExtraPOs((prev) => [...prev, ...newExtras]);
                            setSelectedVendorIds((prev) => {
                              if (prev.has(picked.vendorId)) return prev;
                              const next = new Set(prev);
                              next.add(picked.vendorId);
                              return next;
                            });
                            setLateResolutions((prev) => {
                              const next = { ...prev };
                              delete next[p.vendorId];
                              return next;
                            });
                            /* Close the editor but keep the resolved
                               summary. The resolver card re-renders in
                               its "resolved" mode. */
                            setAcceptEditingKey(null);
                            setAcceptForm(null);
                          };

                          const openForceEditor = () => {
                            setAcceptEditingKey(null);
                            setAcceptForm(null);
                            setForceEditingKey(p.key);
                            setForceForm({
                              vendorId: p.vendorId,
                              qty: p.qty,
                            });
                          };
                          const cancelForceEditor = () => {
                            setForceEditingKey(null);
                            setForceForm(null);
                          };
                          const confirmForceEditor = () => {
                            if (!forceForm || rawsForCard.length === 0) {
                              cancelForceEditor();
                              return;
                            }
                            const forcedVendor = expandedVendors.find(
                              (v) => v.vendorId === forceForm.vendorId,
                            );
                            const idsToMark = new Set<string>(
                              rawsForCard.map((raw) => raw.id),
                            );
                            setMaterializedAutoIds((prev) => {
                              const next = new Set(prev);
                              for (const id of idsToMark) next.add(id);
                              return next;
                            });
                            setExtraPOs((prev) => [
                              ...prev,
                              {
                                id: `xpo-${extraSeq.current++}`,
                                vendorId: forceForm.vendorId,
                                qty: forceForm.qty,
                                arrivalDay: earliestShortfall,
                              },
                            ]);
                            setSelectedVendorIds((prev) => {
                              if (prev.has(forceForm.vendorId)) return prev;
                              const next = new Set(prev);
                              next.add(forceForm.vendorId);
                              return next;
                            });
                            setLateResolutions((prev) => {
                              const next = { ...prev };
                              delete next[p.vendorId];
                              return next;
                            });
                            /* Snapshot the before→after diff for the
                               resolved view. The forced arrival lands on
                               the shortfall day regardless of the
                               vendor's real lead time. */
                            setResolvedByKey((prev) => ({
                              ...prev,
                              [p.key]: {
                                mode: "force",
                                originalVendorId: p.vendorId,
                                originalVendorName: p.vendorName,
                                originalLeadTimeDays: p.leadTimeDays,
                                originalUnitPrice: p.unitPrice,
                                shortfallDay: earliestShortfall,
                                /* MergedPO has arrivalDayMin/Max (a
                                   range across the raw auto-proposed
                                   POs it aggregates), not a single
                                   `arrivalDay`. Use the max so the
                                   before value reflects the latest
                                   currently-scheduled arrival for the
                                   buyer to compare against. */
                                originalArrivalDay: p.arrivalDayMax,
                                originalQty: p.qty,
                                newVendorName: forcedVendor?.vendorName ?? p.vendorName,
                                newLeadTimeDays: forcedVendor?.leadTimeDays ?? 0,
                                newArrivalDay: earliestShortfall,
                                newQty: forceForm.qty,
                              },
                            }));
                            /* Close the editor but keep the resolved
                               summary. The resolver card re-renders in
                               its "resolved" mode. */
                            setForceEditingKey(null);
                            setForceForm(null);
                          };

                          /* When a picker is open for this card, break
                             out of the normal card layout and render a
                             standalone resolution panel in its slot.
                             Distinct border, header, and background so
                             the buyer sees "resolving X" — not "editing
                             within X's card". */
                          if (isResolutionMode) {
                            const isAccept = resolvedSummary
                              ? resolvedSummary.mode === "accept"
                              : isEditingAccept;
                            /* Buyer 2026-08-03: "too much use of color …
                               unable to see the previous state". Redesign:
                               white body, single slim accent rail on the
                               left, subtle tint used only on the eyebrow
                               badge + confirm button. The PO's original
                               row is kept visible as a compact "context
                               strip" at the top of the panel so the
                               buyer can see what they're resolving. */
                            const accent = isAccept ? "#0A77FF" : "#B45309";
                            const tint = isAccept ? "#EFF6FF" : "#FEF7EC";
                            const pickedForForce =
                              forceForm && expandedVendors.find((v) => v.vendorId === forceForm.vendorId);
                            const contextLine = `${p.qty.toLocaleString()} ${item.baseUom} × $${p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${p.leadTimeDays}d lead`;
                            /* Buyer 2026-08-03: "rather than displaying
                               this under the main vendor we can open a
                               sub smaller modal on top and then I will
                               be able to choose". The resolver panel
                               now renders as a nested Radix Dialog on
                               top of the parent Review-N-POs modal. The
                               parent modal (with all its cards) stays
                               visible dimmed behind. Backdrop click /
                               Esc cancels the appropriate editor. */
                            return (
                              <Dialog
                                key={p.key}
                                open={true}
                                onOpenChange={(o) => {
                                  if (!o) {
                                    if (resolvedSummary) {
                                      // Post-confirm state — nothing to
                                      // cancel; just clear the summary
                                      // to close the sub-Dialog.
                                      setResolvedByKey((prev) => {
                                        const next = { ...prev };
                                        delete next[p.key];
                                        return next;
                                      });
                                    } else if (isEditingAccept) {
                                      cancelAcceptEditor();
                                    } else if (isEditingForce) {
                                      cancelForceEditor();
                                    }
                                  }
                                }}
                              >
                                <DialogContent
                                  className="w-[calc(100vw-32px)] sm:max-w-[720px] p-0 gap-0 overflow-hidden bg-white"
                                  style={{ zIndex: 200 }}
                                >
                                  {/* pr-9 leaves room for Radix's
                                      built-in top-right X so it never
                                      overlaps the "Needed by" chip on
                                      the right of the context strip. */}
                                  <div
                                    className="rounded-lg bg-white p-4 pr-9"
                                    style={{
                                      border: "1px solid hsl(var(--border) / 0.7)",
                                      borderLeft: `3px solid ${accent}`,
                                    }}
                                  >
                                {/* Context strip — compact snapshot of the
                                    PO row we're resolving. Buyer keeps
                                    sight of "the previous state" while
                                    picking a resolution. */}
                                <div className="flex items-start gap-2.5 mb-2.5 pb-2.5 border-b border-slate-100">
                                  <VendorLogo
                                    name={p.vendorName}
                                    id={p.vendorId}
                                    size={26}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[12px] font-semibold text-slate-900 truncate">
                                        {p.vendorName}
                                      </span>
                                      {late && (
                                        <span
                                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                                          style={{
                                            backgroundColor: "#FEF2F2",
                                            color: "#B91C1C",
                                          }}
                                        >
                                          Late
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
                                      {contextLine}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                                      Needed by
                                    </div>
                                    <div className="text-[11px] font-semibold text-slate-800 tabular-nums">
                                      {shortfallLabel}
                                    </div>
                                  </div>
                                </div>

                                {/* Header — mode label + description +
                                    close X. Small pill for the mode
                                    instead of a solid colored icon
                                    square. Switches copy to "Resolved"
                                    after the buyer confirms. */}
                                <div className="flex items-start gap-2 mb-2.5">
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                      style={{
                                        backgroundColor: resolvedSummary ? "#ECFDF5" : tint,
                                        color: resolvedSummary ? "#047857" : accent,
                                      }}
                                    >
                                      {resolvedSummary && (
                                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                      )}
                                      {resolvedSummary
                                        ? `Resolved · ${isAccept ? "Accept soonest" : "Force it"}`
                                        : isAccept
                                          ? "Accept soonest"
                                          : "Force it"}
                                    </span>
                                    <div className="mt-1 text-[12px] font-semibold text-slate-800">
                                      {resolvedSummary
                                        ? "Here's the change you just made"
                                        : isAccept
                                          ? "Pick the vendor whose earliest arrival you'll accept"
                                          : "Override the lead time for this vendor"}
                                    </div>
                                    <p className="mt-0.5 text-[10.5px] text-slate-500 leading-snug">
                                      {resolvedSummary
                                        ? "Change or undo below. The projection has already re-run."
                                        : isAccept
                                          ? "The plan re-runs against the chosen vendor's real lead time."
                                          : "Vendor still ships, but we assume the goods arrive on your target date."}
                                    </p>
                                  </div>
                                  {/* Internal X removed 2026-08-03 — the
                                      DialogContent's built-in top-right
                                      close already covers dismissal, and
                                      the two X icons were overlapping
                                      the "Needed by" date. */}
                                </div>

                                {/* Picker body — swaps to a before→after
                                    resolved summary once the buyer
                                    confirms. Buyer 2026-08-03. */}
                                {resolvedSummary ? (
                                  <>
                                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                                      {[
                                        { label: "Vendor", before: resolvedSummary.originalVendorName, after: resolvedSummary.newVendorName },
                                        { label: "Lead time", before: `${resolvedSummary.originalLeadTimeDays}d`, after: `${resolvedSummary.newLeadTimeDays}d` },
                                        {
                                          label: "Arrival",
                                          before: fmtMonthDay(dateFromDayOffset(resolvedSummary.originalArrivalDay)),
                                          after: fmtMonthDay(dateFromDayOffset(resolvedSummary.newArrivalDay)),
                                        },
                                        {
                                          label: "Qty",
                                          before: `${resolvedSummary.originalQty.toLocaleString()} ${item.baseUom}`,
                                          after: `${resolvedSummary.newQty.toLocaleString()} ${item.baseUom}`,
                                        },
                                      ].map((row) => {
                                        const changed = row.before !== row.after;
                                        return (
                                          <div
                                            key={row.label}
                                            className="grid grid-cols-[80px_1fr_16px_1fr] items-center gap-2 px-2.5 py-1.5 text-[11px] border-b border-slate-100 last:border-b-0"
                                          >
                                            <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                                              {row.label}
                                            </span>
                                            <span
                                              className={
                                                changed
                                                  ? "text-slate-500 line-through tabular-nums truncate"
                                                  : "text-slate-500 tabular-nums truncate"
                                              }
                                            >
                                              {row.before}
                                            </span>
                                            <span className="text-slate-300 text-center">→</span>
                                            <span
                                              className={
                                                changed
                                                  ? "font-semibold text-slate-900 tabular-nums truncate"
                                                  : "text-slate-500 tabular-nums truncate"
                                              }
                                              style={changed ? { color: accent } : undefined}
                                            >
                                              {row.after}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          /* Reopen the picker/form to
                                             adjust. We keep the summary
                                             so the resolver stays "in
                                             resolved+editing" mode — the
                                             next confirm overwrites it. */
                                          if (isAccept) {
                                            setAcceptEditingKey(p.key);
                                            setAcceptForm({ vendorId: acceptDefaultId });
                                            setForceEditingKey(null);
                                            setForceForm(null);
                                          } else {
                                            setForceEditingKey(p.key);
                                            setForceForm({
                                              vendorId: p.vendorId,
                                              qty: p.qty,
                                            });
                                            setAcceptEditingKey(null);
                                            setAcceptForm(null);
                                          }
                                          setResolvedByKey((prev) => {
                                            const next = { ...prev };
                                            delete next[p.key];
                                            return next;
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      >
                                        Change
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          /* Undo — wipe the summary AND
                                             any state the confirm wrote
                                             (lateResolutions marker + any
                                             extra POs it created via
                                             resolvedSummary.mode ===
                                             "accept" with a vendor swap
                                             or resolvedSummary.mode ===
                                             "force"). Since extraPOs
                                             here are keyed by
                                             extraSeq-generated ids not
                                             tied back to the summary,
                                             we conservatively just wipe
                                             the summary — the projection
                                             stays as-is unless the buyer
                                             closes and reopens the
                                             modal. */
                                          setResolvedByKey((prev) => {
                                            const next = { ...prev };
                                            delete next[p.key];
                                            return next;
                                          });
                                        }}
                                        className="inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                      >
                                        Undo
                                      </button>
                                      <span className="ml-auto text-[10px] text-slate-500">
                                        Projection re-ran with your pick.
                                      </span>
                                    </div>
                                  </>
                                ) : isAccept && acceptForm ? (
                                  <>
                                    <div
                                      className="max-h-[220px] overflow-y-auto rounded-md border bg-white"
                                      style={{ borderColor: "hsl(var(--border) / 0.7)" }}
                                      role="radiogroup"
                                      aria-label="Choose vendor to accept"
                                    >
                                      {acceptCandidates.map((c, idx) => {
                                        const selected =
                                          acceptForm.vendorId === c.vendorId;
                                        const isSoonest = idx === 0;
                                        const isCurrent = c.vendorId === p.vendorId;
                                        const arrivalDate = fmtMonthDay(
                                          dateFromDayOffset(c.arrivalDay),
                                        );
                                        return (
                                          <label
                                            key={c.vendorId}
                                            className={`flex items-center gap-2 px-2.5 py-2 text-[10.5px] cursor-pointer border-b border-slate-100 last:border-b-0 ${
                                              selected ? "bg-[#EFF6FF]" : "hover:bg-slate-50"
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`accept-picker-${p.key}`}
                                              checked={selected}
                                              onChange={() =>
                                                setAcceptForm({ vendorId: c.vendorId })
                                              }
                                              className="h-3 w-3 shrink-0 accent-[#0A77FF]"
                                            />
                                            <span className="font-semibold text-slate-500 tabular-nums w-6 shrink-0">
                                              #{c.rank}
                                            </span>
                                            <span className="min-w-0 flex-1 text-slate-800 truncate">
                                              {c.vendorName}
                                              {isCurrent && (
                                                <span className="ml-1 text-[9px] uppercase tracking-wide font-bold text-slate-500">
                                                  current
                                                </span>
                                              )}
                                            </span>
                                            {isSoonest && (
                                              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                                Soonest
                                              </span>
                                            )}
                                            <span className="shrink-0 text-slate-500 tabular-nums w-8 text-right">
                                              {c.leadTimeDays}d
                                            </span>
                                            <span className="shrink-0 text-slate-700 tabular-nums w-14 text-right">
                                              {arrivalDate}
                                            </span>
                                            <span
                                              className={`shrink-0 tabular-nums w-16 text-right ${
                                                c.daysLate > 0
                                                  ? "text-rose-600"
                                                  : "text-emerald-700"
                                              }`}
                                            >
                                              {c.daysLate > 0
                                                ? `+${c.daysLate}d late`
                                                : "on time"}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={confirmAcceptEditor}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-[#0A77FF] text-white hover:brightness-105 shadow-sm"
                                      >
                                        <Check className="h-3 w-3" strokeWidth={2.5} />
                                        Confirm pick
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelAcceptEditor}
                                        className="inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                      <span className="ml-auto text-[10px] text-slate-500">
                                        Projection will re-run with your pick.
                                      </span>
                                    </div>
                                  </>
                                ) : isEditingForce && forceForm ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <label className="flex flex-col gap-1 text-[10.5px] text-slate-600">
                                        Vendor
                                        <select
                                          value={forceForm.vendorId}
                                          onChange={(e) =>
                                            setForceForm((prev) =>
                                              prev
                                                ? { ...prev, vendorId: e.target.value }
                                                : prev,
                                            )
                                          }
                                          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
                                        >
                                          {expandedVendors.map((v) => (
                                            <option key={v.vendorId} value={v.vendorId}>
                                              {v.vendorName} · #{v.rank} · {(v.leadTimeDays ?? 0)}d
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1 text-[10.5px] text-slate-600">
                                        Qty ({item.baseUom})
                                        <input
                                          type="number"
                                          min={1}
                                          value={forceForm.qty}
                                          onChange={(e) => {
                                            const raw = Number(e.target.value);
                                            setForceForm((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    qty:
                                                      Number.isFinite(raw) && raw > 0
                                                        ? Math.floor(raw)
                                                        : prev.qty,
                                                  }
                                                : prev,
                                            );
                                          }}
                                          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-800 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#B45309]"
                                        />
                                      </label>
                                    </div>
                                    {pickedForForce && (
                                      <div
                                        className="rounded-md border px-2 py-1.5 text-[10.5px] flex items-center gap-2"
                                        style={{
                                          borderColor: "hsl(var(--border) / 0.7)",
                                          backgroundColor: tint,
                                        }}
                                      >
                                        <ArrowLeft className="h-3 w-3 rotate-180 opacity-60" />
                                        <span className="text-slate-700">
                                          Will plot{" "}
                                          <span className="font-semibold">{forceForm.qty.toLocaleString()} {item.baseUom}</span>{" "}
                                          via <span className="font-semibold">{pickedForForce.vendorName}</span>{" "}
                                          on <span className="font-semibold">{shortfallLabel}</span>
                                          {pickedForForce.vendorId !== p.vendorId && (
                                            <span className="ml-1 text-slate-500">
                                              (replaces {p.vendorName})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={confirmForceEditor}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-white hover:brightness-105 shadow-sm"
                                        style={{ backgroundColor: accent }}
                                      >
                                        <Check className="h-3 w-3" strokeWidth={2.5} />
                                        Confirm force
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelForceEditor}
                                        className="inline-flex items-center h-7 px-2.5 rounded-md text-[11px] font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                      <span className="ml-auto text-[10px] text-slate-500">
                                        Overrides lead time. Projection will re-run.
                                      </span>
                                    </div>
                                  </div>
                                ) : null}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            );
                          }

                          return (
                            <div
                              key={p.key}
                              className="rounded-lg bg-white p-3"
                              style={{
                                border: isNextInQueue
                                  ? "1px solid #0A77FF"
                                  : "1px solid hsl(var(--border) / 0.7)",
                                borderLeft: `3px solid ${late ? "#F1B5B5" : "#0A77FF"}`,
                                boxShadow: isNextInQueue
                                  ? "0 0 0 2px rgba(10, 119, 255, 0.15)"
                                  : undefined,
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <span className="shrink-0 mt-0.5">
                                  <VendorLogo name={p.vendorName} id={p.vendorId} size={32} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="truncate text-[13px] font-semibold text-slate-900">
                                          {p.vendorName}
                                        </span>
                                        {isNextInQueue && (
                                          <span
                                            className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                                            style={{
                                              backgroundColor: "#EFF6FF",
                                              color: "#0A77FF",
                                            }}
                                            title="Resolve this PO next — the projection will re-run when you do."
                                          >
                                            Next up
                                          </span>
                                        )}
                                        {p.count > 1 && (
                                          <span
                                            className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-600 tabular-nums"
                                            title={`${p.count} shortfalls consolidated for this vendor`}
                                          >
                                            ×{p.count}
                                          </span>
                                        )}
                                        {/* Math / why-this-qty tooltip
                                            (buyer 2026-07-22 "hover
                                            showing the math/why"). Same
                                            equation treatment used in
                                            SupplyPlanWizard's WHY THIS
                                            QUANTITY breakdown. */}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              aria-label="Why this quantity"
                                              className="inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-help shrink-0"
                                            >
                                              <Info className="h-3 w-3" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px] text-[11px] leading-snug">
                                            <div className="space-y-1">
                                              <div className="font-semibold text-[10px] uppercase tracking-wide opacity-80">
                                                Why this quantity
                                              </div>
                                              <div>
                                                Rule: trigger{" "}
                                                <span className="font-semibold">
                                                  {TRIGGER_LABEL[recommendationConfig.trigger].toLowerCase()}
                                                </span>
                                                {" → refill to "}
                                                <span className="font-semibold">
                                                  {FILL_LABEL[recommendationConfig.fillTo].toLowerCase()}
                                                </span>
                                                {recommendationConfig.fillTo === "max" && ` (${item.maxLevel} ${item.baseUom})`}
                                                {recommendationConfig.fillTo === "min" && ` (${item.minLevel} ${item.baseUom})`}
                                                .
                                              </div>
                                              <div className="opacity-80">
                                                {p.count > 1
                                                  ? `Summed across ${p.count} shortfall day${p.count === 1 ? "" : "s"} covered by ${p.vendorName}: ${p.qty.toLocaleString()} ${item.baseUom}.`
                                                  : `Ordering ${p.qty.toLocaleString()} ${item.baseUom} to lift projected stock back to the refill target.`}
                                              </div>
                                              <div className="border-t border-white/15 pt-1 mt-1 font-mono text-[10px] opacity-70">
                                                qty = ceil(fillLevel − projectedOnHand)
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500 tabular-nums">
                                        <span>
                                          {p.qty.toLocaleString()} {item.baseUom} × ${p.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{item.baseUom}
                                        </span>
                                        <span className="text-slate-300">·</span>
                                        <span className="inline-flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {p.leadTimeDays}-day lead
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-[13.5px] font-semibold text-slate-900 tabular-nums">
                                        ${rowCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      {/* Status pill IS the trace trigger.
                                          Buyer 2026-08-03: info icon
                                          belongs INSIDE the pill next to
                                          the status label. Popover copy
                                          now uses "on time / late /
                                          shifted" language everywhere —
                                          the legacy "Single solve /
                                          Priority pick / Split / Late
                                          fallback" phrasing was
                                          confusing next to the pill. */}
                                      {(() => {
                                        const pillLabel = late
                                          ? lateMode === "soonest"
                                            ? "shifted"
                                            : "late"
                                          : "on time";
                                        const pillStyle: React.CSSProperties = late
                                          ? lateMode === "soonest"
                                            ? { backgroundColor: "#FEF7EC", color: "#92400E" }
                                            : { backgroundColor: "#FDEEEE", color: "#9F1A1A" }
                                          : { backgroundColor: "#ECFDF5", color: "#047857" };
                                        const pillContent = (
                                          <>
                                            {pillLabel}
                                            {p.autoDecision && (
                                              <Info className="h-2.5 w-2.5 opacity-70" />
                                            )}
                                          </>
                                        );
                                        if (!p.autoDecision) {
                                          return (
                                            <span
                                              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                              style={pillStyle}
                                            >
                                              {pillContent}
                                            </span>
                                          );
                                        }
                                        const decision = p.autoDecision;
                                        const soloCount = decision.candidates.filter((c) => c.canFulfilAlone).length;
                                        const onTimeCount = decision.candidates.filter((c) => c.canArriveOnTime).length;
                                        /* Tooltip header uses the same
                                           on-time/late language as the
                                           pill so the two never drift.
                                           Split cases still surface via
                                           the "chunk N/M" line + the
                                           per-candidate table below. */
                                        const headerLabel = decision.outcome === "late-fallback" ? "LATE" : "ON TIME";
                                        const headerColor = decision.outcome === "late-fallback"
                                          ? { bg: "#FDEEEE", fg: "#9F1A1A" }
                                          : { bg: "#ECFDF5", fg: "#047857" };
                                        let explanation = "";
                                        if (decision.outcome === "single-solve") {
                                          explanation = `${decision.candidates.find((c) => c.vendorId === p.vendorId)?.vendorName ?? "This vendor"} was the only one whose lead time and max order qty both cleared the ${decision.neededQty.toLocaleString()} ${item.baseUom} target on ${fmtMonthDay(dateFromDayOffset(decision.shortfallDay))}.`;
                                        } else if (decision.outcome === "highest-priority-of-many") {
                                          explanation = `${soloCount} vendors could each cover the whole ${decision.neededQty.toLocaleString()} ${item.baseUom} on time — the highest-ranked one won.`;
                                        } else if (decision.outcome === "split-across-vendors") {
                                          explanation = `No single vendor could cover ${decision.neededQty.toLocaleString()} ${item.baseUom} within their max order qty. The plan splits the need across ${decision.chunkCount} vendors in rank order.`;
                                        } else {
                                          explanation = `No vendor's lead time reached the target date. This is the best-available plan — resolve via Accept soonest or Force it.`;
                                        }
                                        return (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-shadow hover:shadow-sm cursor-pointer"
                                                style={pillStyle}
                                                aria-label={`${pillLabel} — why this vendor?`}
                                                title="Why this vendor?"
                                              >
                                                {pillContent}
                                              </button>
                                            </PopoverTrigger>
                                              <PopoverContent
                                                side="top"
                                                align="end"
                                                className="w-[340px] p-0 border-slate-200"
                                              >
                                                <div className="p-3 space-y-2">
                                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                                    <div className="text-slate-700">
                                                      <span className="text-slate-500">Needed</span>{" "}
                                                      <span className="font-semibold text-slate-900 tabular-nums">
                                                        {decision.neededQty.toLocaleString()} {item.baseUom}
                                                      </span>{" "}
                                                      <span className="text-slate-500">by</span>{" "}
                                                      <span className="font-semibold text-slate-900">
                                                        {fmtMonthDay(dateFromDayOffset(decision.shortfallDay))}
                                                      </span>
                                                    </div>
                                                    <span
                                                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                                      style={{
                                                        backgroundColor: headerColor.bg,
                                                        color: headerColor.fg,
                                                      }}
                                                    >
                                                      {headerLabel}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-[10.5px] text-slate-500 tabular-nums">
                                                    <span>{onTimeCount}/{decision.candidates.length} on time</span>
                                                    <span className="text-slate-300">·</span>
                                                    <span>{soloCount}/{decision.candidates.length} solves alone</span>
                                                    {decision.chunkCount > 1 && (
                                                      <>
                                                        <span className="text-slate-300">·</span>
                                                        <span>chunk {decision.chunkIndex + 1}/{decision.chunkCount}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="max-h-[240px] overflow-y-auto border-t border-slate-100">
                                                  {decision.candidates.map((c) => {
                                                    const won = c.vendorId === p.vendorId;
                                                    return (
                                                      <div
                                                        key={c.vendorId}
                                                        className={`flex items-center gap-2 px-3 py-1.5 text-[10.5px] border-b border-slate-50 last:border-b-0 ${won ? "bg-emerald-50" : ""}`}
                                                      >
                                                        <span className="font-semibold text-slate-500 tabular-nums w-6 shrink-0">#{c.rank}</span>
                                                        <span className="min-w-0 flex-1 text-slate-800 truncate">
                                                          {c.vendorName}
                                                          {won && (
                                                            <span className="ml-1 text-[9px] uppercase tracking-wide font-bold text-emerald-700">
                                                              picked
                                                            </span>
                                                          )}
                                                        </span>
                                                        <span className="text-slate-500 tabular-nums shrink-0">{c.leadTimeDays}d</span>
                                                        <span className="text-slate-500 tabular-nums shrink-0 w-10 text-right">{c.maxOrderQty.toLocaleString()}</span>
                                                        <span className="shrink-0 w-4 flex justify-center" title={c.canArriveOnTime ? "On time" : "Late"}>
                                                          {c.canArriveOnTime ? (
                                                            <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                                                          ) : (
                                                            <X className="h-3 w-3 text-rose-500" strokeWidth={3} />
                                                          )}
                                                        </span>
                                                        <span className="shrink-0 w-4 flex justify-center" title={c.canFulfilAlone ? "Can cover on its own" : "Can't cover on its own"}>
                                                          {c.canFulfilAlone ? (
                                                            <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                                                          ) : (
                                                            <X className="h-3 w-3 text-rose-500" strokeWidth={3} />
                                                          )}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                                <div className="border-t border-slate-100 px-3 py-2 text-[10.5px] text-slate-600 leading-snug bg-slate-50/60">
                                                  {explanation}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          );
                                        })()}
                                    </div>
                                  </div>
                                  <div
                                    className="mt-2 flex items-center gap-2 text-[11.5px] text-slate-500"
                                    title={`Order ${orderRange} → arrival ${arrivalRange}`}
                                  >
                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                    <span>
                                      {lateMode === "soonest" ? "Soonest arrival" : "Expected delivery"}{" "}
                                      <span className="font-semibold text-slate-700">{arrivalRange}</span>
                                    </span>
                                    {/* Outcome chip moved to a small info
                                        button next to the status pill
                                        above (buyer 2026-08-03). Nothing
                                        else lives on this row anymore. */}
                                  </div>
                                </div>
                              </div>
                              {/* Per-card resolution actions — Eli
                                  2026-07-30: the resolver lives INSIDE
                                  this modal, not a separate popup. Only
                                  render for LATE cards; on-time cards
                                  stay clean. */}
                              {late && (
                                <div className="mt-2 border-t border-slate-100 pt-2 space-y-2">
                                  {lateMode === "soonest" ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                                        <Check className="h-3 w-3" strokeWidth={2.5} />
                                        Accepted soonest — arrives {arrivalRange}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLateResolutions((prev) => {
                                            const next = { ...prev };
                                            delete next[p.vendorId];
                                            return next;
                                          });
                                        }}
                                        className="ml-auto text-[10.5px] text-slate-500 hover:text-slate-700 underline decoration-slate-300 underline-offset-2"
                                      >
                                        Undo
                                      </button>
                                    </div>
                                  ) : (
                                    /* Only Accept-soonest surfaces on the
                                       late card — buyer 2026-08-03: "if I
                                       don't take any action like accept
                                       the soonest it means I am forcing
                                       this vendor". Leaving the card
                                       as-is is the implicit "force it"
                                       action; the batch "Apply all —
                                       Force at optimal" is still there
                                       for the multi-late case. */
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={openAcceptEditor}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold border border-[#0A77FF] bg-[#EFF6FF] text-[#0A77FF] hover:bg-[#DBEAFE] transition-colors"
                                        title="Pick a vendor whose soonest arrival to accept"
                                      >
                                        <Check className="h-3 w-3" strokeWidth={2.5} />
                                        Accept soonest available
                                        <ChevronDown className="h-3 w-3 opacity-70" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                          });
                          /* Phantom resolved cards — cards whose original
                             merged PO was materialized into extraPOs (and
                             therefore no longer appears in orderedPOs)
                             because the buyer resolved to a different
                             vendor. Without this pass the visual resolved
                             state disappeared entirely — buyer 2026-08-03:
                             "I am selecting another vendor it is closing
                             the modal for me not showing what I have
                             changed to". Rendered read-only (no
                             Change/Undo) since undoing would need to
                             rollback the extraPOs the confirm added. */
                          return (
                            <>
                              {mainCards}
                              {phantomResolved.map(([key, summary]) => {
                                const isAccept = summary.mode === "accept";
                                const accent = isAccept ? "#0A77FF" : "#B45309";
                                const contextLine = `${summary.originalQty.toLocaleString()} ${item.baseUom} × $${summary.originalUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${summary.originalLeadTimeDays}d lead`;
                                const shortfallLabel = fmtMonthDay(
                                  dateFromDayOffset(summary.shortfallDay),
                                );
                                return (
                                  <div
                                    key={`resolved-${key}`}
                                    className="rounded-lg bg-white p-3"
                                    style={{
                                      border: "1px solid hsl(var(--border) / 0.7)",
                                      borderLeft: `3px solid ${accent}`,
                                    }}
                                  >
                                    {/* Context strip — snapshot of the
                                        card BEFORE resolution. */}
                                    <div className="flex items-start gap-2.5 mb-2.5 pb-2.5 border-b border-slate-100">
                                      <VendorLogo
                                        name={summary.originalVendorName}
                                        id={summary.originalVendorId}
                                        size={26}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[12px] font-semibold text-slate-900 truncate">
                                            {summary.originalVendorName}
                                          </span>
                                          <span
                                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                                            style={{ backgroundColor: "#FEF2F2", color: "#B91C1C" }}
                                          >
                                            Late
                                          </span>
                                        </div>
                                        <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
                                          {contextLine}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                                          Needed by
                                        </div>
                                        <div className="text-[11px] font-semibold text-slate-800 tabular-nums">
                                          {shortfallLabel}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Resolved badge + description. */}
                                    <div className="mb-2.5">
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                        style={{ backgroundColor: "#ECFDF5", color: "#047857" }}
                                      >
                                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                        {`Resolved · ${isAccept ? "Accept soonest" : "Force it"}`}
                                      </span>
                                      <div className="mt-1 text-[12px] font-semibold text-slate-800">
                                        Here's the change you just made
                                      </div>
                                      <p className="mt-0.5 text-[10.5px] text-slate-500 leading-snug">
                                        The plan re-ran with your pick. Add it to cart or view on graph to continue.
                                      </p>
                                    </div>

                                    {/* Diff table. */}
                                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                                      {[
                                        { label: "Vendor", before: summary.originalVendorName, after: summary.newVendorName },
                                        { label: "Lead time", before: `${summary.originalLeadTimeDays}d`, after: `${summary.newLeadTimeDays}d` },
                                        {
                                          label: "Arrival",
                                          before: fmtMonthDay(dateFromDayOffset(summary.originalArrivalDay)),
                                          after: fmtMonthDay(dateFromDayOffset(summary.newArrivalDay)),
                                        },
                                        {
                                          label: "Qty",
                                          before: `${summary.originalQty.toLocaleString()} ${item.baseUom}`,
                                          after: `${summary.newQty.toLocaleString()} ${item.baseUom}`,
                                        },
                                      ].map((row) => {
                                        const changed = row.before !== row.after;
                                        return (
                                          <div
                                            key={row.label}
                                            className="grid grid-cols-[80px_1fr_16px_1fr] items-center gap-2 px-2.5 py-1.5 text-[11px] border-b border-slate-100 last:border-b-0"
                                          >
                                            <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                                              {row.label}
                                            </span>
                                            <span
                                              className={
                                                changed
                                                  ? "text-slate-500 line-through tabular-nums truncate"
                                                  : "text-slate-500 tabular-nums truncate"
                                              }
                                            >
                                              {row.before}
                                            </span>
                                            <span className="text-slate-300 text-center">→</span>
                                            <span
                                              className={
                                                changed
                                                  ? "font-semibold text-slate-900 tabular-nums truncate"
                                                  : "text-slate-500 tabular-nums truncate"
                                              }
                                              style={changed ? { color: accent } : undefined}
                                            >
                                              {row.after}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500 text-right">
                                      Projection re-ran with your pick.
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                  {/* Footer — totals + close */}
                  <div className="px-5 py-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
                    <div className="text-[12.5px] text-slate-500">
                      {totalOrders > 0 && (
                        <>
                          Total ·{" "}
                          <span className="font-semibold text-slate-700 tabular-nums">
                            {totalQty.toLocaleString()} {item.baseUom}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {totalOrders > 0 && (
                        <span className="text-[15px] font-semibold text-slate-900 tabular-nums">
                          ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {/* CTA order flipped 2026-08-03. Add-to-cart used to
                          be the primary blue button and Eli hit it ~4
                          times accidentally, so it moves to a secondary
                          outline treatment. "View on graph" (which
                          closes the modal, returning the buyer to the
                          graph) becomes the primary. The Close button
                          is dropped entirely — the X icon in the header
                          already handles dismissal. */}
                      {totalOrders > 0 && item && (
                        <button
                          type="button"
                          onClick={() => {
                            for (const p of autoProposedPOs) {
                              const unit = effectivePrice(p.unitPrice, p.pricingRules, p.qty);
                              const catalogItem: CatalogItem = {
                                id: `${SANDBOX_CART_PREFIX}${item.itemCode}::${p.id}`,
                                itemNumber: item.itemCode,
                                descriptiveName: item.itemName,
                                image: item.itemImage,
                                unitPrice: unit,
                                currentStock: item.onHand,
                                minQuantity: item.minLevel,
                                shortageDate: null,
                                partnerLocation: p.vendorName,
                                category: item.category,
                                location: "",
                                vendorUOM: item.purchaseUom,
                                vendorUOMQty: 1,
                                defaultUOM: item.baseUom,
                                discount: 0,
                              };
                              addToCart({
                                catalogItem,
                                vendorQty: p.qty,
                                quantity: p.qty,
                                unitPrice: unit,
                                discount: 0,
                                shipByDate: isoFromDay(Math.max(0, p.arrivalDay - p.leadTimeDays)),
                                shipmentMethod: "Standard",
                                needByDate: isoFromDay(p.arrivalDay),
                                inboundLocation: "Default",
                              });
                            }
                            const n = autoProposedPOs.length;
                            /* Buyer 2026-08-03: "whatever happens user
                               will be staying on this modal". Add-to-cart
                               no longer closes the Review dialog — the
                               buyer stays put and can keep resolving or
                               tweaking. Toast confirms + gives an
                               explicit "Open cart" jump if they want it. */
                            toast.success(`Added ${n} auto PO${n === 1 ? "" : "s"} to cart`, {
                              description: "Review and submit them from the cart.",
                              action: { label: "Open cart", onClick: () => navigate("/cart") },
                            });
                          }}
                          className="inline-flex items-center gap-1.5 h-9 rounded-md px-4 text-[12.5px] font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to cart
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          /* Buyer 2026-08-03: "make sure when I am plotting
                             on the graph I am seeing the exact data on the
                             graph". Confirm the plotted totals in a toast
                             on close so the buyer sees the summary that
                             matches what the graph reflects — same
                             autoProposedPOs + extraPOs feed both the modal
                             and the graph, so counts, arrival days, and
                             pricing stay in sync. */
                          setAutoBreakdownOpen(false);
                          if (totalOrders > 0) {
                            toast.info(
                              `Plotted ${totalOrders} PO${totalOrders === 1 ? "" : "s"} on the graph`,
                              {
                                description: `Total ${totalQty.toLocaleString()} ${item.baseUom} · $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              },
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1.5 h-9 rounded-md px-4 text-[12.5px] font-medium bg-[#0A77FF] text-white hover:brightness-105 transition-all shadow-sm"
                      >
                        View on graph
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}
        </div>
      );
    return null;
  };
  const panelBody = (key: PanelKey): ReactNode => {
    if (key === "vendors") {
      /* Per-vendor Auto-fill roll-up — the auto proposals share the same PO
         set as the graph banner + breakdown modal, so the vendor panel can
         surface a compact emerald badge on any vendor Auto is using. */
      const autoByVendor = new Map<string, { count: number; qty: number }>();
      for (const p of autoProposedPOs) {
        const cur = autoByVendor.get(p.vendorId) ?? { count: 0, qty: 0 };
        autoByVendor.set(p.vendorId, { count: cur.count + 1, qty: cur.qty + p.qty });
      }
      return (
        <div className="h-full overflow-auto scrollbar-planner p-5">
          <PlannerVendorPanel
            item={item}
            vendors={expandedVendors}
            allVendors={expandedAllVendors}
            needByDay={needByDay}
            planning={planningSummary}
            baseUom={item.baseUom}
            allocations={allocations}
            arrivalByVendor={arrivalByVendor}
            /* Snapshot-view lock: allocations are frozen so the panel
               reads as static (buyer feedback 2026-07-20). */
            onSetAllocation={isSnapshotView ? () => {} : setAllocation}
            viewOnly={isSnapshotView}
            autoAllocations={autoByVendor}
          />
        </div>
      );
    }
    if (key === "graph") {
      /* Auto-fill status banner — a persistent, clickable pill rendered
         INSIDE the plot area at top-center (see PlannerGapGraph's
         `autoBanner` prop). Same shape as the red drag-warning pill but
         emerald-tinted (Active gradient family) so it never collides with
         the drag-warning scenario. Clicking it opens the same "View details"
         breakdown the Auto dropdown option carries. */
      const autoActive = recommendationConfig.trigger !== "off";
      const autoBannerVisible = autoActive && autoProposedPOs.length > 0;
      const autoLabel =
        recommendationConfig.trigger === "min"
          ? "Min threshold"
          : recommendationConfig.trigger === "zero"
            ? "Below zero"
            : TRIGGER_LABEL[recommendationConfig.trigger];
      const bannerVendorCount = new Set(autoProposedPOs.map((p) => p.vendorId)).size;
      const autoBanner = autoBannerVisible ? {
        label: autoLabel,
        poCount: autoProposedPOs.length,
        vendorCount: bannerVendorCount,
        onClick: () => setAutoBreakdownOpen(true),
      } : null;
      /* Top-left note (buyer feedback 2026-07-20): in Auto mode,
         when the buyer has also plotted their own POs, tell them.
         One line, no em-dash. Only shown when Auto is active AND
         the buyer has ≥1 manual planned PO. */
      const manualPoCount = manualProposedPOs.length;
      const topLeftNote =
        autoActive && manualPoCount > 0
          ? `You added ${manualPoCount} planned PO${manualPoCount === 1 ? "" : "s"} on top of Auto`
          : null;
      return (
        <div className="h-full p-4 relative flex flex-col gap-1.5 min-h-0">
          {/* Snapshot-view chrome scoped to the graph panel — buyer
              feedback 2026-07-20: "only on the graph area, not the
              entire screen" + "the top banner needs to be on the
              graph as well." Frame overlay is absolute inset-0
              (pointer-events-none), so the graph underneath still
              receives hover / scroll (mutation locks are handled by
              PlannerGapGraph's viewOnly prop). Banner sits at the
              top as a shrink-0 flex row so the graph fills the rest
              of the panel via flex-1. */}
          {isSnapshotView && <SnapshotFrameOverlay />}
          {isSnapshotView && snapshotViewMode && (
            <div className="shrink-0">
              <SnapshotBanner
                snapshotName={snapshotViewMode.snapshotName}
                createdAt={snapshotViewMode.createdAt}
                onBack={handleExitSnapshotView}
                onMakeActive={() => setConfirmMakeActive(true)}
              />
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col">
          <PlannerGapGraph
            autoBanner={autoBanner}
            topLeftNote={topLeftNote}
            editingSupplyRequest={
              editingExtraPO
                ? {
                    id: editingExtraPO.id,
                    vendorId: editingExtraPO.vendorId,
                    qty: editingExtraPO.qty,
                    arrivalDay: editingExtraPO.arrivalDay,
                  }
                : null
            }
            onEditSupplyRequested={isSnapshotView ? undefined : handleStartEditExtraPO}
            onEditSupplyCancel={isSnapshotView ? undefined : handleCancelEditExtraPO}
            item={item}
            curve={curve}
            baselineCurve={baselineCurve}
            events={graphEvents}
            horizonDays={horizonDays}
            startDay={horizonStartDay}
            fillHeight
            deadlineDay={needByDay}
            unitsToCover={unitsToCover}
            /* Snapshot-view read-only lock (2026-07-20 buyer feedback).
               Every mutation callback is elided when isSnapshotView is
               true; the graph already gates its Add / Plot chooser
               entry points on callback presence, so passing undefined
               hides those affordances. Drag / need-by / order-by are
               additionally frozen by the `viewOnly` prop threaded
               into PlannerGapGraph. */
            viewOnly={isSnapshotView}
            onNeedByChange={isSnapshotView ? undefined : setNeedByOverride}
            needByIsManual={needByOverride != null}
            needByAutoDay={defaultNeedByDay}
            orderByDay={orderByDay}
            onOrderByChange={isSnapshotView ? undefined : setOrderByOverride}
            orderByIsManual={orderByOverride != null}
            orderByAutoDay={defaultOrderByDay}
            recommendedLeadDays={recommendedLeadDays}
            onMoveEvent={isSnapshotView ? () => {} : moveEvent}
            onToggleEvent={isSnapshotView ? () => {} : toggleEvent}
            showEvents={false}
            onSimulateAdd={
              isSnapshotView
                ? undefined
                : (d) =>
                    /* Route the graph's Simulate add to the SAME store the
                       table uses (simulatedTxns) so the entry appears on
                       BOTH surfaces — a row in the table AND a dot on the
                       graph — and moves the shared curve. */
                    addSimulatedTxn({
                      direction: d.direction,
                      typeLabel: d.typeLabel,
                      qty: d.qty,
                      date: d.date,
                    })
            }
            vendors={expandedVendors}
            allVendors={expandedAllVendors}
            onPlotVendor={isSnapshotView ? undefined : plotVendorAt}
            onHoverDay={setHoverDay}
            /* Reverse hover bridge (req #6): a transaction-table row hover sets
               hoverDay too, so the graph surfaces that day's card. */
            externalHoverDay={hoverDay}
            onRemoveEvent={isSnapshotView ? undefined : removeGraphEvent}
            onClearProposedPOs={isSnapshotView ? undefined : clearProposedPOs}
            onClearSimulations={isSnapshotView ? undefined : clearSimulations}
            onClearAll={isSnapshotView ? undefined : clearGraphSimulations}
            /* Shared source of truth for "Draft purchase orders" — the
               graph legend chip and the Transaction Table's "Draft
               purchase orders" pill both read/write this state, so
               toggling either surface hides drafts everywhere
               (graph dots + tx rows + projected curve). */
            showDrafts={showDrafts}
            onShowDraftsChange={setShowDrafts}
          />
          </div>
        </div>
      );
    }
    /* The transaction stream owns its own internal scroll — the table body
       scrolls, the pagination footer stays pinned. Don't wrap in
       `overflow-auto` (that would scroll the whole thing and hide the
       footer). `flex flex-col min-h-0` lets the stream fill the parent
       card's height so its inner `flex-1` regions can size correctly. */
    return <div className="h-full min-h-0 flex flex-col overflow-hidden">{transactionStream()}</div>;
  };

  return (
    /* Viewport-bounded layout — the WHOLE workspace fits inside the viewport
       so the page never scrolls; every internal region (vendor list,
       transaction table body, day-card popovers) owns its own scroll.
       `h-screen overflow-hidden` locks the root to the viewport height;
       the flex-column child chain (top-bar shrink-0 → body flex-1 min-h-0 →
       classic-view flex-1 min-h-0) distributes that height across the
       header + item card + graph row + vendors/transactions row. */
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Snapshot-view chrome (banner + photo-frame border) lives
          *inside* the graph panel — see the graph render below.
          Buyer feedback 2026-07-20: the banner + border should scope
          to the graph area, not the whole workspace, so the static
          snapshot treatment aligns with the "picture of a plan" it
          represents. */}
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-3 py-2 2xl:gap-4 2xl:px-5 2xl:py-3">
          <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
            <BackButton onClick={backToListing} title="Back to Procurement Planning" compact />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-900">Procurement Planning</h1>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: "#EFF6FF", color: VIOLET }}
                >
                  Sandbox
                </span>
              </div>
              <p className="mt-0.5 hidden truncate text-xs text-slate-500 lg:block">
                Plan replenishment by adding vendors and setting quantities to move projected stock toward its target level.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 2xl:gap-3">
            {/* Dev-only journey switcher (first-time ⇄ recurring) + scenario
               map — the workspace's analogue of the listing's top-bar slot. */}
            <PlannerDevWidget />
            {plannedInCart > 0 && (
              <button
                onClick={() => navigate("/cart")}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 2xl:px-2.5 2xl:py-1 2xl:text-xs"
              >
                <ShoppingCart className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" />
                {plannedInCart} planned in cart
              </button>
            )}
            <span className="text-[11px] text-slate-400 2xl:text-xs">
              {tabs.length} item{tabs.length === 1 ? "" : "s"} in this session
            </span>
            {/* Reset the free-form panel arrangement — only in the Classic grid
                view (the Timeline has no movable panels). Lives here so it no
                longer takes a row of its own above the grid. */}
            {!isFirstItem && (
              <button
                type="button"
                onClick={resetPanelLayout}
                title="Reset the panel layout to its default arrangement"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 2xl:px-2.5 2xl:py-1 2xl:text-xs"
              >
                <RotateCcw className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" /> Reset layout
              </button>
            )}
            {/* Primary switcher — Layout version (V1 vs V2). Filled
                segmented control so it reads as the buyer's main
                choice on this toolbar. Active segment fills with
                primary blue + white text; inactive stays transparent
                with slate text so the active option pops. */}
            <div
              role="radiogroup"
              aria-label="Layout"
              className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm 2xl:h-8"
            >
              {([
                { key: "v1", label: "V1", Icon: Columns3, title: "V1 — Vendors · Transactions · Graph in three columns" },
                { key: "v2", label: "V2", Icon: Rows2,   title: "V2 — Graph on top, Vendors + Transactions below" },
              ] as const).map(({ key, label, Icon, title }) => {
                const active = sandboxVariant === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    onClick={() => setSandboxVariant(key)}
                    aria-checked={active}
                    aria-pressed={active}
                    title={title}
                    className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-wide transition-colors 2xl:h-7 2xl:gap-1.5 2xl:px-2.5 2xl:text-[11.5px] ${
                      active
                        ? "text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}
                    style={active ? { backgroundColor: "#0A77FF" } : undefined}
                  >
                    <Icon className="size-3 2xl:size-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Secondary View-width toggle removed 2026-07-22 — the
                planner is always full-width now; the icon-toggle
                affordance was redundant with the primary Layout
                switcher. */}
            {/* "Add item" moved into the tab strip below (Chrome-style +
                button next to the tabs). Removed from the top-right so
                the header stays focused on layout / view controls. */}
          </div>
        </div>

        {/* ── Item tabs — "Group by" control + the tabs, auto-grouped by the
            chosen dimension (Chrome tab-groups style). groupBy="none" ⇒ the
            original flat strip.
            Compact-mode is width-driven (Rida A3): the tabs only compress to
            code-only when they'd actually overflow the container, not at a
            hard-coded count. ── */}
        <div className="flex items-stretch gap-1 px-2 2xl:gap-1.5 2xl:px-3">
          {/* "Group by" control, then a divider, then the auto-grouped tabs.
              ("Add item" now lives in the header as the primary action.) */}
          <GroupByControl groupBy={groupBy} />
          <div className="h-4 w-px shrink-0 self-center bg-slate-200 2xl:h-5" aria-hidden />
          {/* `flex-1 min-w-0` — the tab strip now claims the FULL remaining
              header width (Chrome tab-bar behaviour). Two knock-on effects:
              (1) On wide screens with few tabs, the strip visually extends
              to the header's right edge instead of clustering left; (2)
              `tabStripWidth` measured by the ResizeObserver is now the
              actual available space, so the width-driven compact-mode
              trigger (`tabs.length > tabStripWidth / UNCOMPACTED_TAB_WIDTH`)
              only fires when tabs would truly overflow — matching how
              Chrome shrinks tabs to fit rather than scrolling early. */}
          <div ref={tabStripRef} className="flex flex-1 min-w-0 items-stretch gap-0.5 overflow-x-auto">
            {/* Chrome-style "+" — renders after the last tab (or last
                group) so it sits inline with the tab row. Icon-only
                square button, subtle by default, fills on hover.
                Replaces the top-right "Add item" primary button so
                the "new item" gesture lives right next to the tabs
                the buyer's already looking at. */}
            {tabGroups === null ? (
              <>
                {tabs.map((t, idx) => (
                  <TabChip
                    key={t.itemCode}
                    item={t}
                    active={t.itemCode === activeCode}
                    onSelect={goToItem}
                    onClose={handleCloseTab}
                    compact={idx >= namedTabCount}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  title="Add item"
                  aria-label="Add item"
                  className="ml-0.5 shrink-0 self-center inline-flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 2xl:size-7"
                >
                  <Plus className="size-3.5 2xl:size-4" />
                </button>
              </>
            ) : (
              tabGroups.map((g, gi) => {
                  /* Chrome tab-group: a small FLOATING label tag, centred in a
                     full-height wrapper whose bottom border carries the group
                     colour line UNDER the tag too; then its tabs in a flush row
                     continuing that line and arching over the active tab. A
                     hairline divider sits between groups. */
                  return (
                    <Fragment key={g.key}>
                      {gi > 0 && (
                        <div
                          className="mx-0.5 h-4 w-px shrink-0 self-center bg-slate-200 2xl:h-5"
                          aria-hidden
                        />
                      )}
                      <div className="flex shrink-0 items-stretch">
                        {/* Full-height cell: its bottom border is the group line
                            under the floating tag; pr-1.5 is the gap, with the
                            line running on under it into the tabs. */}
                        <div
                          className="flex items-center border-b-[3px] pr-1.5"
                          style={{ borderBottomColor: g.tone.dot }}
                        >
                          <GroupHeaderChip group={g} />
                        </div>
                        <div className="flex items-end">
                          {g.items.map((t) => {
                            /* Compaction uses the tab's GLOBAL index in
                               the flat `tabs` array so the progressive
                               fallback (named → icon-only) counts across
                               groups, not per-group. */
                            const globalIdx = tabs.findIndex((x) => x.itemCode === t.itemCode);
                            return (
                              <TabChip
                                key={t.itemCode}
                                item={t}
                                active={t.itemCode === activeCode}
                                onSelect={goToItem}
                                onClose={handleCloseTab}
                                groupTone={g.tone}
                                compact={globalIdx >= namedTabCount}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </Fragment>
                  );
                })
            )}
            {tabGroups !== null && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                title="Add item"
                aria-label="Add item"
                className="ml-1 shrink-0 self-center inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={`mx-auto w-full ${maxWidthClass} flex-1 min-h-0 flex flex-col gap-3 px-4 py-4 2xl:gap-4 2xl:px-5 2xl:py-5`}>
        {/* Item header — mirrors the PO detail / partner header: avatar + title
            + status on the left, the primary "Create purchase orders" CTA on
            the right (moved up from the old footer), and the health metric
            strip below. */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm 2xl:p-4">
          {/* Title row — identity left, primary action right */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 2xl:h-12 2xl:w-12">
                <ImageWithFallback
                  src={item.itemImage}
                  alt={item.itemName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[14px] font-semibold text-slate-900 2xl:text-base">{item.itemCode}</h2>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: sev.bg, color: sev.fg, border: `1px solid ${sev.border}` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sev.dot }} />
                    {sev.label}
                  </span>
                </div>
                <p className="truncate text-[12.5px] text-slate-600 2xl:text-sm">{item.itemName}</p>
                <p className="truncate text-[11px] text-slate-400 2xl:text-xs">{item.description}</p>
              </div>
            </div>

            {/* Action cluster — the order summary as a tidy stat panel + the
                solid CTA. The CTA always carries an on-hover hint; late arrivals
                inform there rather than blocking via a checkbox. */}
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
              {(proposedPOs.length > 0 || createDisabledReason || lateCount > 0) && (
                <div className="flex flex-col gap-1.5">
                  {proposedPOs.length > 0 && (
                    <div className="flex items-center gap-4 sm:gap-5 2xl:sm:gap-6">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Units</div>
                        <div className="text-[12.5px] font-medium tabular-nums text-slate-700 2xl:text-sm">
                          {totalUnits.toLocaleString()} {item.baseUom}
                        </div>
                      </div>
                      <div className="h-6 w-px shrink-0 bg-slate-200/80 2xl:h-7" />
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total cost</div>
                        <div className="text-[14px] font-semibold tabular-nums text-slate-800 2xl:text-base">
                          ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="h-6 w-px shrink-0 bg-slate-200/80 2xl:h-7" />
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Orders</div>
                        <div className="text-[12.5px] font-medium tabular-nums text-slate-700 2xl:text-sm">
                          {proposedPOs.length} PO{proposedPOs.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  )}
                  {(createDisabledReason || lateCount > 0) && (
                    <p
                      className={`flex items-center gap-1 text-[10.5px] leading-snug 2xl:text-[11px] ${
                        createDisabledReason ? "text-slate-400" : "text-amber-600"
                      }`}
                    >
                      {!createDisabledReason && lateCount > 0 && (
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0 2xl:h-3 2xl:w-3" />
                      )}
                      {createHint}
                    </p>
                  )}
                </div>
              )}
              {createButton}
            </div>
          </div>

          {/* KPI chips — compact, matching the Purchase Orders listing pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <KpiChip label="On-hand" value={`${item.onHand}`} unit={item.baseUom} />
            <KpiChip label="ATP today" value={`${Math.round(metrics.atp)}`} unit={item.baseUom} />
            <KpiChip
              label="Gap"
              value={`${metrics.worst > 0 ? "+" : ""}${Math.round(metrics.worst)}`}
              unit={item.baseUom}
              tone={metrics.worst < 0 ? "red" : metrics.worst < item.minLevel ? "amber" : "green"}
            />
            <KpiChip
              label="Min / Max"
              value={`${item.minLevel} / ${item.maxLevel}`}
              unit={item.baseUom}
            />
          </div>
        </div>

        {isFirstItem && SHOW_TIMELINE_VARIATION ? (
          <>
          <PlannerTimelineCanvas
            item={item}
            baseUom={item.baseUom}
            horizonDays={horizonDays}
            horizonOptions={HORIZON_OPTIONS}
            onHorizonChange={setHorizonDays}
            needByDay={needByDay}
            curve={curve}
            baselineCurve={baselineCurve}
            events={timelineEvents}
            vendors={expandedVendors}
            selectedVendorIds={selectedVendorIds}
            allocations={allocations}
            arrivalByVendor={arrivalByVendor}
            onMoveEvent={moveEvent}
            onToggleEvent={toggleEvent}
            onToggleVendor={toggleVendor}
            onSetAllocation={setAllocation}
            extraPOs={extraPOs}
            onAddExtraPO={addExtraPO}
            onRemoveExtraPO={removeExtraPO}
            onSetExtraPOQty={setExtraPOQty}
            onAddMock={addMock}
            onRemoveMock={removeMock}
            hasOverrides={hasOverrides || mockEvents.length > 0 || extraPOs.length > 0}
            onResetOverrides={() => {
              setOverrides(new Map());
              setMockEvents([]);
              setExtraPOs([]);
            }}
          />
          {renderTimelineTransactions()}
          </>
        ) : (() => {
          /* ── Sandbox layouts ──
             v1: 3-column row — Vendors · Transactions · Graph. Side panels
                  can collapse to a vertical rail; graph absorbs freed width.
             v2: 2 rows — Graph on top (~30% height), Vendors + Transactions
                  side-by-side below (~70% height). Same cards, same collapse
                  behaviour; the layout wrapper just changes.
             Extract the three cards into JSX variables so both branches
             render the exact same component tree with only the wrapper
             differing. */
          const renderSidePanel = (key: "vendors" | "transactions") => {
            const isCollapsed = !!panelLayout.collapsed[key];
            const meta = PANEL_META[key];
            if (isCollapsed) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePanelCollapsed(key)}
                  title={`Expand ${meta.title.toLowerCase()} panel`}
                  aria-label={`Expand ${meta.title.toLowerCase()} panel`}
                  aria-expanded={false}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors hover:bg-slate-50 lg:h-full lg:w-12 lg:shrink-0 lg:flex-col lg:justify-start lg:py-3"
                >
                  <PanelLeftOpen className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
                  <span className="text-xs font-semibold tracking-wide text-slate-600">
                    <span className="lg:hidden">{meta.title}</span>
                    <span
                      className="hidden lg:inline"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    >
                      {meta.title}
                    </span>
                  </span>
                </button>
              );
            }
            return (
              <section
                key={key}
                className={`flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
                  /* Same widths in v1 and v2 — vendors is a fixed 340px rail
                     (the buyer never resizes it in either layout), transactions
                     absorbs the rest of the row. */
                  key === "vendors"
                    ? "lg:w-[340px] lg:shrink-0"
                    : "lg:flex-1 lg:min-w-[360px]"
                }`}
              >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 2xl:px-5 2xl:py-3">
                  <div className="min-w-0">
                    <h3 className="text-[12.5px] font-semibold text-slate-900">{meta.title}</h3>
                    <p className="text-[10.5px] text-slate-500 line-clamp-2">{meta.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePanelCollapsed(key)}
                    title="Collapse to a rail"
                    aria-label={`Collapse ${meta.title.toLowerCase()} panel`}
                    aria-expanded={true}
                    className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                  </button>
                </header>
                <div className="min-h-0 flex-1">{panelBody(key)}</div>
              </section>
            );
          };
          const graphCard = (
            <section
              className={`flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
                sandboxVariant === "v1"
                  ? /* v1 — sticky in the 3-col row so the graph never scrolls
                       out of view on stacked (< lg) layouts. */
                    "order-first lg:order-none sticky top-16 z-10 lg:static lg:top-auto lg:z-auto lg:flex-1 lg:min-w-[520px]"
                  : /* v2 — the graph card fills its wrapper row (row 1). The
                       wrapper below carries the ~30%-height sizing. */
                    "flex-1"
              }`}
            >
              <header className="flex shrink-0 flex-col items-stretch gap-2 border-b border-slate-100 px-3 py-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-3 2xl:px-5 2xl:py-3">
                <div className="min-w-0">
                  <h3 className="text-[12.5px] font-semibold text-slate-900">{PANEL_META.graph.title}</h3>
                  <p className="text-[10.5px] text-slate-500 line-clamp-2">{PANEL_META.graph.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 flex-wrap 2xl:flex-nowrap">{panelRight("graph")}</div>
              </header>
              <div className={`min-h-0 flex-1 ${sandboxVariant === "v2" ? "" : "min-h-[520px] lg:min-h-0"}`}>
                {panelBody("graph")}
              </div>
            </section>
          );

          if (sandboxVariant === "v2") {
            /* ── v2 layout — snap-scroll, one row at a time ──
               Row 1: Graph — occupies one full viewport of the panel area.
               Row 2: Vendors + Transactions — same, sits directly below.
               CSS scroll-snap means the buyer either sees the graph OR
               the vendors/transactions row, never a compressed hybrid.
               A floating indicator on the right edge advertises the
               other row and scrolls to it on click.
               Below lg (mobile / narrow) the snap behaviour is dropped
               and the whole thing stacks + scrolls naturally.

               Buyer feedback 2026-07-16: "collapse doesn't expand the
               graph the rest of the way when you collapse the table."
               When the transactions panel is collapsed to a rail, row 2's
               content shrinks — the snap-scroll's forced full-viewport
               height then leaves a lot of empty space and the graph
               (row 1) doesn't benefit. Fix: when EITHER side panel is
               collapsed, drop row 2's `min-h-full` so its height becomes
               content-driven; also drop snap-scroll in that state so
               the buyer can smoothly scan graph → panels. */
            const vendorsCollapsed = !!panelLayout.collapsed.vendors;
            const transactionsCollapsed = !!panelLayout.collapsed.transactions;
            const anyPanelCollapsed = vendorsCollapsed || transactionsCollapsed;
            return (
              <div className="relative flex flex-col lg:flex-1 lg:min-h-0">
                <div
                  ref={v2ScrollRef}
                  className={`flex flex-col gap-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto ${
                    anyPanelCollapsed ? "" : "lg:snap-y lg:snap-mandatory"
                  }`}
                >
                  {/* Row 1 — full viewport height on lg+, snap-align start */}
                  <div className="w-full min-h-[300px] lg:h-full lg:min-h-full lg:shrink-0 lg:snap-start flex">
                    {graphCard}
                  </div>
                  {/* Row 2 — full viewport height ONLY when both panels are
                      expanded; otherwise content-driven so the collapsed
                      rail doesn't create empty space and the graph up-top
                      gets the freed room via natural scroll flow. */}
                  <div
                    className={`flex flex-col gap-3 lg:flex-row lg:items-stretch lg:shrink-0 lg:snap-start ${
                      anyPanelCollapsed ? "" : "lg:h-full lg:min-h-full"
                    }`}
                  >
                    {renderSidePanel("vendors")}
                    {renderSidePanel("transactions")}
                  </div>
                </div>
                {/* Scroll indicator — right edge, hidden below lg. Points
                    toward whichever row is currently OFF-screen. Clicking
                    smooth-scrolls the outer container to that row. */}
                <button
                  type="button"
                  onClick={() => scrollV2To(v2Section === "graph" ? "panels" : "graph")}
                  title={v2Section === "graph" ? "Scroll to vendors & transactions" : "Scroll back to the graph"}
                  aria-label={v2Section === "graph" ? "Scroll to vendors and transactions" : "Scroll back to the graph"}
                  className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-md backdrop-blur transition-all hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {v2Section === "graph" ? (
                    <>
                      <span>Vendors &amp; Transactions</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      <span>Back to graph</span>
                    </>
                  )}
                </button>
              </div>
            );
          }

          /* ── v1 layout — Vendors · Transactions · Graph in a row. ──
             Transactions ↔ Graph is resizable via a draggable divider
             on lg+ (buyer feedback 2026-07-10). Below lg the panels
             stack; no resize handle at that width. Sizes are NOT
             persisted per buyer preference — each visit resets to
             55% / 45% defaults. Vendors stays a fixed rail (its own
             collapse chevron handles narrowing).

             Buyer feedback 2026-07-19: when transactions collapses,
             the graph should absorb ALL the freed width — no empty
             space. Previously the ResizablePanelGroup held onto its
             55% allocation even after the transactions section
             replaced itself with a w-12 rail button, leaving a wide
             dead zone next to the rail. Fix: when transactions is
             collapsed on desktop, bypass the ResizablePanelGroup and
             lay out the rail + graph as plain flex items (rail keeps
             its w-12, graph gets `flex-1`). Resizing is only useful
             when both are expanded anyway. */
          const v1TransactionsCollapsed = !!panelLayout.collapsed.transactions;
          return (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:flex-1 lg:min-h-0">
              {renderSidePanel("vendors")}
              {/* Mobile fallback — plain stack (below lg the drag handle
                  would be too small for touch). Uses lg:hidden to avoid
                  paying the double-render cost on desktop. */}
              <div className="flex flex-col gap-3 lg:hidden">
                {renderSidePanel("transactions")}
                {graphCard}
              </div>
              {/* Desktop — resizable Transactions ↔ Graph when both
                  are expanded; plain flex when transactions is
                  collapsed (so the graph absorbs the whole width). */}
              {v1TransactionsCollapsed ? (
                <div className="hidden lg:flex lg:flex-1 lg:min-h-0 lg:items-stretch gap-3">
                  {renderSidePanel("transactions")}
                  {graphCard}
                </div>
              ) : (
                <div ref={txGraphRowRef} className="hidden lg:flex lg:flex-1 lg:min-h-0">
                  <ResizablePanelGroup
                    ref={txGraphGroupRef}
                    direction="horizontal"
                    className="gap-3"
                    /* Live floor enforcement — react-resizable-panels
                       doesn't always clamp when minSize changes after
                       mount or on fast drags. onLayout fires every
                       tick during a drag; if either side has slipped
                       below its floor, snap it back. The 0.5 epsilon
                       prevents a resize-onLayout-resize loop when the
                       value is already at the floor. */
                    onLayout={(sizes) => {
                      if (!sizes || sizes.length < 2) return;
                      const [txSize, graphSize] = sizes;
                      if (graphSize < graphMinPct - 0.5 && graphPanelRef.current) {
                        graphPanelRef.current.resize(graphMinPct);
                      } else if (txSize < txMinPct - 0.5 && txPanelRef.current) {
                        txPanelRef.current.resize(txMinPct);
                      }
                    }}
                  >
                    <ResizablePanel
                      ref={txPanelRef}
                      /* Tx defaults to the auto-target (compressed
                         30% share at wide widths, less when columns
                         are hidden). Hard floor 12% lets the buyer
                         shrink the panel even further; horizontal
                         scroll inside the table handles content
                         overflow (Eli 2026-07-30). */
                      defaultSize={txAutoTargetPct}
                      minSize={txMinPct}
                      maxSize={100 - graphMinPct}
                      className="flex flex-col min-h-0"
                    >
                      {renderSidePanel("transactions")}
                    </ResizablePanel>
                    <ResizableHandle
                      withHandle
                      onDragging={(dragging) => {
                        if (dragging) buyerDraggedRef.current = true;
                      }}
                    />
                    <ResizablePanel
                      ref={graphPanelRef}
                      defaultSize={100 - txAutoTargetPct}
                      minSize={graphMinPct}
                      className="flex flex-col min-h-0"
                    >
                      {graphCard}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              )}
            </div>
          );
        })()}

      </div>


      {/* Add items to the sandbox — the exact ported Manage-Items modal,
          scoped to the open tabs (commitSandboxItems diffs the selection). */}
      <PlannerManageItemsModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        items={sandboxItemUniverse}
        selectedCodes={openItems}
        onChange={commitSandboxItems}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden bg-white p-0">
          {/* ── Header — icon tile + title (pr-12 clears the built-in close ×) ── */}
          <div className="flex items-start gap-3 px-5 pb-4 pr-12 pt-5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${VIOLET}14` }}
            >
              <ShoppingCart className="h-5 w-5" style={{ color: VIOLET }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold text-slate-900">
                Add {proposedPOs.length} purchase order{proposedPOs.length === 1 ? "" : "s"} to cart?
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px] text-slate-500">
                Added to your cart for review before they're sent to vendors.
              </DialogDescription>
            </div>
          </div>

          {/* ── The item this plan is for ── */}
          <div className="px-5">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
              <ImageWithFallback
                src={item.itemImage}
                alt={item.itemName}
                className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{item.itemName}</div>
                <div className="truncate text-xs text-slate-500">
                  {item.itemCode}
                  {item.category ? ` · ${categoryCodeFor(item.category)}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* ── Coverage outcome — does this plan close the gap? (ties the cart
               action back to the planning panel's shortfall). ── */}
          <div className="px-5">
            {(() => {
              const need = planningSummary.orderNeeded;
              const allocated = totalUnits;
              const remaining = Math.max(0, need - allocated);
              const fullyCovers = need === 0 || allocated >= need;
              const CovIcon = fullyCovers ? CheckCircle2 : AlertTriangle;
              const cov = fullyCovers
                ? { bg: "#ECFDF5", bd: "#A7F3D0", fg: "#047857" }
                : { bg: "#FFFBEB", bd: "#FDE68A", fg: "#B45309" };
              const text =
                need === 0
                  ? "No shortage to cover — this keeps the item at or above its minimum."
                  : fullyCovers
                    ? `Brings this item back up to its minimum level (${allocated} of ${need} ${item.baseUom}).`
                    : `Covers ${allocated} of ${need} ${item.baseUom} needed — still ${remaining} ${item.baseUom} short of minimum.`;
              return (
                <div
                  className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px]"
                  style={{ backgroundColor: cov.bg, borderColor: cov.bd, color: cov.fg }}
                >
                  <CovIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="font-medium">{text}</span>
                </div>
              );
            })()}
          </div>

          {/* ── Planned PO lines (blue accent = the graph's "Planned PO") ── */}
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto px-5">
            {proposedPOs.map((p) => {
              const v = expandedAllVendors.find((x) => x.vendorId === p.vendorId);
              const eff = effectivePrice(p.unitPrice, p.pricingRules, p.qty);
              const lineTotal = p.qty * eff;
              const late =
                p.shortfallDay != null
                  ? p.arrivalDay > p.shortfallDay
                  : needByDay != null && p.arrivalDay > needByDay;
              const maxQ = v ? vendorConstraints(item, v).maxOrderQty : undefined;
              const overMax = maxQ != null && p.qty > maxQ;
              const orderLabel =
                p.orderDay <= 0
                  ? `today, ${fmtMonthDay(dateFromDayOffset(0))}`
                  : fmtMonthDay(dateFromDayOffset(p.orderDay));
              const arriveLabel = fmtMonthDay(dateFromDayOffset(p.arrivalDay));
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                  style={{ boxShadow: `inset 3px 0 0 0 ${VIOLET}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <VendorLogo name={p.vendorName} id={p.vendorId} size={28} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {p.vendorName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                          <span className="tabular-nums">
                            {p.qty} {item.baseUom} × ${eff.toFixed(2)}/{item.baseUom}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {p.leadTimeDays}-day lead
                          </span>
                        </div>
                        {p.pricingRules.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {p.pricingRules.map((r, i) => (
                              <PlannerPricingRuleBadge key={i} rule={r} uom={item.baseUom} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        ${lineTotal.toFixed(2)}
                      </div>
                      <span
                        className="mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: late ? "#FEE2E2" : "#DCFCE7",
                          color: late ? "#B91C1C" : "#15803D",
                        }}
                      >
                        {late ? "arrives late" : "on time"}
                      </span>
                    </div>
                  </div>
                  {/* Order date → arrival date (the two-date model). */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11.5px] text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      Order <span className="font-medium text-slate-700">{orderLabel}</span>
                    </span>
                    <span className="text-slate-300">→</span>
                    <span>
                      expected delivery <span className="font-medium text-slate-700">{arriveLabel}</span>
                    </span>
                    {overMax && (
                      <span className="ml-auto font-medium text-amber-600">over max</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Total ── */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-sm text-slate-500">
              Total · <span className="tabular-nums">{totalUnits} {item.baseUom}</span>
            </span>
            <span className="text-lg font-semibold text-slate-900 tabular-nums">
              ${totalCost.toFixed(2)}
            </span>
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={executeToCart}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-95"
              style={{ backgroundColor: VIOLET }}
            >
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Snapshots — compare modal + restore banner ── */}
      <PlannerSnapshotCompare
        open={compareSnapshots.length >= 2}
        onOpenChange={(o) => { if (!o) setCompareSnapshots([]); }}
        snapshots={compareSnapshots}
        onOpenSnapshot={handleOpenSnapshot}
      />
      {restoreBanner && (
        <div className="fixed inset-x-0 top-14 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto max-w-[720px] w-full flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 shadow-lg">
            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1 text-[12px] text-blue-900">
              <div className="font-semibold">
                Loaded "{restoreBanner.snapshotName}"
              </div>
              <div className="mt-0.5 leading-snug text-blue-800/90">
                {restoreBanner.diff.hasAnyChange ? (
                  <>Since this snapshot was taken: {summarizeDiff(restoreBanner.diff)}. Your saved plan is showing against the current world.</>
                ) : (
                  <>No changes since this snapshot was taken.</>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRestoreBanner(null)}
              className="rounded-md p-1 text-blue-700 transition-colors hover:bg-blue-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Make-active confirm — promoting a snapshot replaces the
          buyer's buffered active plan, which is destructive. Buyer
          feedback 2026-07-20: guard the promotion behind an explicit
          red-glow confirm so a stray click doesn't overwrite work.
          Rendered inline (rather than via ConfirmDiscardModal) so the
          confirm button uses hardcoded hex colors — the shared modal
          renders `var(--destructive)` unwrapped, which the browser
          reads as invalid and paints the button transparent. */}
      <AlertDialog open={confirmMakeActive} onOpenChange={setConfirmMakeActive}>
        <AlertDialogContent
          className="p-0 gap-0 overflow-hidden border-0"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
            width: "calc(100% - 2rem)",
            maxWidth: 440,
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
            zIndex: 14000,
          }}
        >
          {/* Red-glow header — mirrors the destructive palette of the
              canonical PODiscardDialog / partner cancel-confirmation
              treatments so the promotion reads clearly as a
              destructive-tinted step. */}
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{
              background:
                "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
              style={{ backgroundColor: "#EF4444" }}
            />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "#FEE2E2" }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "#DC2626" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px] font-semibold uppercase"
              style={{
                letterSpacing: "0.05em",
                backgroundColor: "#FEF2F2",
                color: "#991B1B",
              }}
            >
              Promote snapshot
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "#0F172A" }}
            >
              Make this snapshot your active plan?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-[13px] mt-2 mx-auto"
              style={{ color: "#64748B", lineHeight: "1.65", maxWidth: 320 }}
            >
              {snapshotViewMode
                ? `"${snapshotViewMode.snapshotName}" will become your live editable plan. Your current active plan will be discarded.`
                : "Your current active plan will be discarded."}
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleMakeSnapshotActive}
                className="w-full h-11 text-[14px] rounded-xl border-0 transition-colors"
                style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#FFFFFF", cursor: "pointer" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#B91C1C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#DC2626";
                }}
              >
                Make active
              </button>
              <button
                type="button"
                onClick={() => setConfirmMakeActive(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#E2E8F0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                }}
              >
                Keep viewing snapshot
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────────── SMALL PARTS ─────────────────────────── */

/** Compact KPI chip — the Purchase Orders listing's pill style: a muted label,
    a bold (optionally tinted) value, and a small unit. Replaces the old large
    metric cards in the item header. */
function KpiChip({
  label,
  value,
  unit,
  tone = "slate",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "slate" | "red" | "amber" | "green";
}) {
  const valColor =
    tone === "red"
      ? "#DC2626"
      : tone === "amber"
        ? "#C2410C"
        : tone === "green"
          ? "#15803D"
          : "#0F172A";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 2xl:gap-1.5 2xl:px-2.5 2xl:py-1">
      <span className="text-[10px] font-medium text-slate-500 2xl:text-[11px]">{label}</span>
      <span
        className="text-[12px] font-semibold leading-none tabular-nums 2xl:text-[13px]"
        style={{ color: valColor }}
      >
        {value}
      </span>
      {unit && <span className="text-[9.5px] text-slate-400 2xl:text-[10px]">{unit}</span>}
    </span>
  );
}
