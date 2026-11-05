/* ═══════════════════════════════════════════════════════════════
   Procurement Planning — Parameter set + persistence
   ───────────────────────────────────────────────────────────────
   The Procurement Planning tab lands on the listing with an empty
   state; the data table renders once the buyer sets a scope (time /
   demand sources / categories). This module owns:
     · the parameter shape + default set
     · last-applied + applied-flag persistence (one slot)
     · a single named saved view ("name your search")
     · preset definitions for the quick-start row

   Sort is intentionally NOT part of the parameter set anymore — it's
   a result-view concern that the host (PODemands) tracks in its own
   state and exposes from the table toolbar, not the entry surface.
   ═══════════════════════════════════════════════════════════════ */

import { OWNED_CATEGORY_CODES } from "./PlannerManageCategoriesModal";
import { MY_OWNER_NAME } from "./plannerData";

export type DemandSourceKind = "SO" | "Request" | "LowStock";

/* ═══════════════════════════════════════════════════════════════
   Purchase Requests parked from procurement (2026-07-20)
   ───────────────────────────────────────────────────────────────
   Buyer decision 2026-07-20: hide every Purchase Request surface
   inside the Procurement Planning section (planner listing, scope
   filters, transaction stream, graph legend). The standalone
   `/purchase-requests` requester-side app is untouched.

   Every planner PR code path gates on this flag. Flip to `true`
   to bring the chrome back. Underlying mock demand rows sourced
   from Requests were removed in the same change — restoring
   populated PR rows means re-adding data to `plannerData.ts` (or
   reverting that same commit).
   ═══════════════════════════════════════════════════════════════ */
export const SHOW_PURCHASE_REQUESTS_IN_PLANNER = false;

/* Stocking-level severity bands — a free-combine filter on the
   parameter set. Each item falls into exactly one band based on where
   its current ATP sits relative to its min / max stocking levels:
     · "below-zero" — ATP < 0              (out of stock / backordered)
     · "below-min"  — 0 ≤ ATP < minLevel   (below the reorder floor)
     · "below-max"  — minLevel ≤ ATP < maxLevel (below target, not critical)
   Above-max ADDED 2026-07-14 (Nophil feedback: overstock is a real
   issue — SO cancels, BOM changes, buyer keeps ordering — and nobody
   catches it because the tool only modeled inventory going down).
   Severity order (most severe first):
     below-zero > below-min > above-max > below-max
   — overstock ties up capital but never stops production, so it slots
   between shortage bands and the healthy-trending band. */
export type LevelBand = "below-zero" | "below-min" | "above-max" | "below-max";

/** Bands in descending severity — the canonical order for sorting
    "most severe first" and for rendering the filter chips.
    2026-07-14 (revised): `below-max` restored per buyer feedback —
    surfacing it as an early "stock is below the max but still fine"
    signal lets buyers plan ahead. */
/* Order Eli 2026-07-16: below-zero → below-min → below-max → above-max
   (worst-to-mildest for the below family; above-max last since it's an
   overstock/capital-tied-up flavour, distinct from availability risk). */
export const LEVEL_BANDS_BY_SEVERITY: LevelBand[] = [
  "below-zero",
  "below-min",
  "below-max",
  "above-max",
];

/** Overstock threshold — refines the `above-max` band pill so buyers can
 *  say "only show me items materially over max, not screws over by 3".
 *  · `mode: "any"` — every above-max item passes (raw pill).
 *  · `mode: "pct"` — keep only items whose projected on-hand exceeds
 *    `maxLevel * (1 + value/100)`. Percent is the default normaliser
 *    because unit price ≠ quantity (10 cars over max ≫ 10 000 screws).
 *  · `mode: "qty"` — keep only items exceeding max by ≥ `value` units.
 *    For large-max items where percent gets tiny.
 *  Default: `{ mode: "pct", value: 50 }` — filters out rounding noise
 *  but catches the "vendor plotted then SO cancelled" scenarios. */
export interface OverstockThreshold {
  mode: "any" | "pct" | "qty";
  value: number;
}
export const DEFAULT_OVERSTOCK_THRESHOLD: OverstockThreshold = {
  mode: "pct",
  value: 50,
};

/* Need-by timing filter — drives the decision-oriented presets
   ("Overdue now", "Due this week"). Vocabulary matches what already
   shows on the listing's Need by / Days Left columns:
     · "all"      — no narrowing
     · "overdue"  — items whose earliest Need by date has passed
     · "due"      — items whose earliest Need by date falls inside the
                    `horizonDays` window
   The labels the buyer sees are "Overdue" and "Due" — both already
   approved vocabulary on this surface. */
export type Timing = "all" | "overdue" | "due";

/* Entry-time parameters scope the dataset before the table loads.
   The fields below are the *primary* scoping concerns at entry time —
   what time window, which demand sources, which product categories,
   and whether to narrow to items currently below their stocking levels.

   What's intentionally NOT here:
     · Vendors — vendor selection is a per-item decision the buyer
       makes inside the Sandbox after they've identified a problem.
     · Severity — the planner team's E3 directive ("severity is
       parked, don't lead with severity") removed it from the headline
       surfaces. It's no longer an entry-time filter, a table column,
       or a toolbar filter.

   Purchasing owner + acquisition method USED to be toolbar-only (the
   owner list can run long, so they lived as post-load refinements).
   Per Eli's feedback they are now entry-time scope too: surfaced in the
   Plan Inventory modal (a searchable owner picker + Purchased /
   Manufactured pills), with the toolbar dropdowns reading the same
   params so there's one source of truth. Empty arrays still mean "all". */
export interface ProcurementPlanningParams {
  /** Day window driving ATP projection + transaction stream slicing. */
  horizonDays: number;
  /** Demand sources to include (empty = all). */
  sources: DemandSourceKind[];
  /** Item categories to include (empty = all). Lets the buyer scope
      to a product family ("I'm planning hydraulics today"). */
  categories: string[];
  /** Stocking-level severity bands to include (empty = no band
      narrowing). Free-combine: an item matches if its band is in this
      set. See `LevelBand`. */
  bands: LevelBand[];
  /** Need-by timing filter — drops rows by their earliest Need by date
      relative to today. Powers the decision-oriented presets
      ("Overdue now", "Due this week"). */
  timing: Timing;
  /** Specific item codes to include (empty = all). Set via the entry
      modal's item picker (Nophil: item-level filters). */
  items: string[];
  /** Scope to items the buyer owns — and, in the pickers, show only the
      buyer's owned categories + items (Nophil: "items I own / categories
      I own"). Empty/false = everyone's. */
  mineOnly: boolean;
  /** Purchasing owners to include (empty = all owners). Set from the Plan
      Inventory modal's owner picker AND the toolbar Owner dropdown — both
      read/write this one field. */
  purchasingOwners: string[];
  /** Acquisition methods to include (empty = all methods). Values are
      "Purchased" / "Manufactured"; an item matches if its primary OR
      secondary method is in the set. */
  acquisitionMethods: string[];
  /** Custom planning-window range (ISO yyyy-mm-dd). When `customEnd` is
      set, the window is this custom range rather than a `horizonDays`
      preset; `horizonDays` is kept in sync (days from today → customEnd)
      so the ATP-projection pipeline stays unchanged. */
  customStart?: string;
  customEnd?: string;
  /** Refines the `above-max` band membership. Ignored when the band
      isn't in `bands`. `null` = accept every above-max row (equivalent
      to `{ mode: "any", value: 0 }` but kept null so paramsEqual /
      hasActiveScope don't count it as a narrowing on its own). */
  overstockThreshold?: OverstockThreshold | null;
  /** Include items that don't currently trigger any issue band (Eli
      2026-07-09: Nophil's seasonal-buyer scenario — the buyer wants
      to plan / sandbox an item that isn't running short today). When
      false (default) the listing narrows to items with a live band
      (below-zero / below-min / above-max). When true, healthy items
      pass through too. */
  includeItemsWithoutIssues?: boolean;
}

/* Default scope treats Procurement Planning as a personal workspace: the
   buyer lands with their own purchasing-owner name pre-selected AND the
   categories they own pre-checked, so first paint answers "what do I
   need to plan for MY desk today?" without a click. Widening is one
   toggle away (uncheck the You pill, add another owner, add categories).

   The Plan Inventory modal reads these same defaults, so opening the
   scope questionnaire shows the buyer already pre-selected (with the
   "You" badge) and their category set already ticked.

   Sourced from the planner registry:
     · `MY_OWNER_NAME` — the row flagged `ownedByMe: true` (same source
       as the Owner column + "You" badge).
     · `OWNED_CATEGORY_CODES` — the CATEGORY_ROWS where `isMe: true`.
   If nobody is flagged `ownedByMe`, the owner filter falls back to
   empty ("all owners") so the surface still renders.

   `mineOnly: true` matches the pre-checked category set — the "Start
   with categories I own" toggle in the modal reads/writes this flag,
   and having it on visually mirrors the pre-selection.

   The scope-bar chip row's Me pill (`plannerOwnership` in PODemands)
   defaults to "all" to avoid double-narrowing (scope already carries
   the "me" cut); the pill still works as a widen affordance once the
   buyer removes their own name from the owner set. */
/* Sentinel meaning "no time cap" — the Planning Period defaults here.
   Chosen as a very large value (10,000 days ≈ 27 years) so `d <=
   horizonDays` filter comparisons pass for every reasonable projection
   day. The scope questionnaire renders this as the "All time" pill and
   the summary strings switch to unbounded phrasing. */
export const ALL_TIME_HORIZON = 10000;

export const DEFAULT_PARAMS: ProcurementPlanningParams = {
  /* Next 30 days by default — buyer feedback 2026-07-13 reverses the
     2026-07-10 "All time" call. Planning starts with a bounded window
     so the table isn't drowned in far-out projections; buyers who need
     a longer horizon widen from the Planning period chip.
     `ALL_TIME_HORIZON` sentinel is still exported and still reads as
     "All time" in the picker + summary helpers. */
  horizonDays: 30,
  sources: [],
  categories: [...OWNED_CATEGORY_CODES],
  bands: [],
  timing: "all",
  items: [],
  mineOnly: true,
  purchasingOwners: MY_OWNER_NAME ? [MY_OWNER_NAME] : [],
  acquisitionMethods: [],
  overstockThreshold: null,
  includeItemsWithoutIssues: false,
};

/* Fully-empty scope — no narrowing on any dimension. `DEFAULT_PARAMS`
   above is the *pre-selected* landing state (me + owned categories); it
   is still an *applied filter set* from the buyer's perspective, so the
   scope-bar Clear all needs to be able to strip it further. This
   constant is what Clear all resets to, what the "Showing the default
   view — all sources, next 30 days" banner reads against, and what
   `hasActiveScope` checks to decide whether ANY narrowing is in effect
   (pre-selection included).

   Kept in one place so PlannerScopeBar (Clear all), PODemands
   (hasActiveScope + banner), and the empty-state fallback all agree
   on what "no filters" means. */
export const NO_NARROWING_PARAMS: ProcurementPlanningParams = {
  horizonDays: ALL_TIME_HORIZON,
  sources: [],
  categories: [],
  bands: [],
  timing: "all",
  items: [],
  mineOnly: false,
  purchasingOwners: [],
  acquisitionMethods: [],
  overstockThreshold: null,
  includeItemsWithoutIssues: true,
};

/* Tolerant band parser — accepts the current `bands` array and also
   migrates legacy single-value `levelsFilter` payloads (v3/v4) onto the
   new band set so a returning buyer's saved scope survives the upgrade. */
const VALID_BANDS: LevelBand[] = ["below-zero", "below-min", "below-max"];
function sanitizeBands(src: { bands?: unknown; levelsFilter?: unknown }): LevelBand[] {
  if (Array.isArray(src.bands)) {
    return src.bands.filter((b): b is LevelBand =>
      VALID_BANDS.includes(b as LevelBand),
    );
  }
  if (src.levelsFilter === "below-min") return ["below-min"];
  if (src.levelsFilter === "below-max") return ["below-max"];
  return [];
}

/* Storage key bumped v7 → v8 for the personal-workspace defaults
   (purchasingOwners=[me], categories=[owned], mineOnly=true). Returning
   buyers with a persisted v7 payload — which typically carries empty
   owner/category arrays from the previous "empty defaults" era — would
   otherwise skip the pre-selection entirely. Bumping the key drops
   them through to the new defaults once, then persistence resumes. */
const STORAGE_KEY = "po:procurement-planning:params:v8";
const SAVED_VIEW_KEY = "po:procurement-planning:saved-view:v1";
/* The `APPLIED_KEY` flag that previously persisted "has the buyer
   committed to a scope yet?" is retired. The entry overview now
   shows on every tab entry — the buyer reviews their filters each
   visit and clicks Open in listing to proceed. Only the params
   themselves persist (via `STORAGE_KEY` above), so the entry
   pre-fills with the last scope they built. */

/* ─────────────────────────── PARAMS PERSISTENCE ─────────────────────────── */

export function loadParams(): ProcurementPlanningParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    /* Tolerant loader — handles legacy payloads that carried
       `vendors` + `owners` (v2), a single `levelsFilter` (v3/v4 — now
       migrated onto `bands`), or omit `timing`. Unrecognised keys drop. */
    const parsed = JSON.parse(raw) as Partial<ProcurementPlanningParams> & {
      levelsFilter?: unknown;
    };
    const bands = sanitizeBands(parsed);
    const timing =
      parsed.timing === "overdue" || parsed.timing === "due" || parsed.timing === "all"
        ? parsed.timing
        : "all";
    return {
      ...DEFAULT_PARAMS,
      ...parsed,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      items: Array.isArray(parsed.items)
        ? parsed.items.filter((x): x is string => typeof x === "string")
        : [],
      purchasingOwners: Array.isArray(parsed.purchasingOwners)
        ? parsed.purchasingOwners.filter((x): x is string => typeof x === "string")
        : [],
      acquisitionMethods: Array.isArray(parsed.acquisitionMethods)
        ? parsed.acquisitionMethods.filter((x): x is string => typeof x === "string")
        : [],
      mineOnly: parsed.mineOnly === true,
      customStart: typeof parsed.customStart === "string" ? parsed.customStart : undefined,
      customEnd: typeof parsed.customEnd === "string" ? parsed.customEnd : undefined,
      bands,
      timing,
    };
  } catch {
    return null;
  }
}

export function saveParams(params: ProcurementPlanningParams): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/* ─────────────────────────── SAVED VIEW ───────────────────────────
   ONE explicit saved view + the implicit last-applied set the buyer
   carries forward across sessions. The saved view gets a name so the
   buyer can recognise it ("My Q1 review" / "Honda this week" / etc.).
   Keeping the surface to a single slot keeps the entry tidy; if we
   later want named multi-view we can expand SavedView → SavedView[]. */

export interface SavedView {
  /** Human-readable label set by the buyer. */
  name: string;
  /** Captured parameter set. */
  params: ProcurementPlanningParams;
  /** ms epoch — used for "saved {N} days ago" hints. */
  createdAt: number;
}

export function loadSavedView(): SavedView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedView>;
    if (!parsed || typeof parsed.name !== "string" || !parsed.params) return null;
    const rawParams = parsed.params as Partial<ProcurementPlanningParams> & {
      levelsFilter?: unknown;
    };
    const bands = sanitizeBands(rawParams);
    const timing =
      rawParams.timing === "overdue" ||
      rawParams.timing === "due" ||
      rawParams.timing === "all"
        ? rawParams.timing
        : "all";
    return {
      name: parsed.name,
      params: {
        ...DEFAULT_PARAMS,
        ...rawParams,
        sources: Array.isArray(rawParams.sources) ? rawParams.sources : [],
        categories: Array.isArray(rawParams.categories) ? rawParams.categories : [],
        items: Array.isArray(rawParams.items)
          ? rawParams.items.filter((x): x is string => typeof x === "string")
          : [],
        purchasingOwners: Array.isArray(rawParams.purchasingOwners)
          ? rawParams.purchasingOwners.filter((x): x is string => typeof x === "string")
          : [],
        acquisitionMethods: Array.isArray(rawParams.acquisitionMethods)
          ? rawParams.acquisitionMethods.filter((x): x is string => typeof x === "string")
          : [],
        mineOnly: rawParams.mineOnly === true,
        customStart: typeof rawParams.customStart === "string" ? rawParams.customStart : undefined,
        customEnd: typeof rawParams.customEnd === "string" ? rawParams.customEnd : undefined,
        bands,
        timing,
      },
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveSavedView(view: SavedView | null): void {
  if (typeof window === "undefined") return;
  try {
    if (view) window.localStorage.setItem(SAVED_VIEW_KEY, JSON.stringify(view));
    else window.localStorage.removeItem(SAVED_VIEW_KEY);
  } catch {
    /* ignore */
  }
}

/* ─────────────────────────── PRESETS ───────────────────────────
   Quick-start chip-cards on the entry surface. Each preset is a
   one-click apply — clicking immediately commits the params and
   lands the buyer on the results table. Definitions live here so
   the entry component and any callers (Cmd-K, deep links, etc.)
   share the same source of truth.

   Preset labels deliberately reuse the existing demand-source +
   levels vocabulary the buyer already sees on rows — no new
   marketing terms. Each label IS its descriptor. */

export type PresetId =
  | "overdue-now"
  | "due-this-week"
  | "low-stock-to-reorder"
  | "open-sales-order-demand"
  | "all-demand";

export interface PresetDef {
  id: PresetId;
  label: string;
  description: string;
  /** Build params for this preset. */
  build(): ProcurementPlanningParams;
}

/* Decision-oriented presets — each is a question a purchasing manager
   would actually ask, mapped onto the existing parameter shape (no
   new fields needed beyond `timing`, which is itself driven by the
   already-approved "Overdue" / "Due" vocabulary on the listing).

     · "What's past its Need by date right now?"        → Overdue now
     · "What ships inside the next 7 days?"             → Due this week
     · "What's flagged for reorder?"                    → Low Stock to reorder
     · "What's customer-driven demand right now?"       → Open Sales Order demand
     · "Show me the whole pipeline"                     → All Demand

   Each label uses only approved terminology — Overdue, Due, Low Stock,
   Sales Order, All Demand. No marketing names. */
export const PRESETS: PresetDef[] = [
  {
    id: "overdue-now",
    label: "Overdue now",
    description: "Items past their earliest Need by date",
    build: () => ({
      ...DEFAULT_PARAMS,
      timing: "overdue",
    }),
  },
  {
    id: "due-this-week",
    label: "Due this week",
    description: "Items with Need by inside the next 7 days",
    build: () => ({
      ...DEFAULT_PARAMS,
      horizonDays: 7,
      timing: "due",
    }),
  },
  {
    id: "low-stock-to-reorder",
    label: "Low Stock to reorder",
    description: "Items flagged by low-stock triggers",
    build: () => ({
      ...DEFAULT_PARAMS,
      sources: ["LowStock"],
    }),
  },
  {
    id: "open-sales-order-demand",
    label: "Open Sales Order demand",
    description: "Sales orders only — no internal requests or alerts",
    build: () => ({
      ...DEFAULT_PARAMS,
      sources: ["SO"],
    }),
  },
  {
    id: "all-demand",
    label: "All Demand",
    description: "Whole pipeline, no narrowing",
    build: () => DEFAULT_PARAMS,
  },
];

/* ─────────────────────────── HELPERS ─────────────────────────── */

/** Label for a `LevelBand` value — drives the Issues column badge, the
    filter chips and the scope summary so every surface speaks the same
    vocabulary. Full words per the agreed Issues terminology:
    Below Zero · Below Minimum · Below Maximum. */
export function bandLabel(v: LevelBand): string {
  switch (v) {
    case "below-zero":
      return "Below Zero";
    case "below-min":
      return "Below Minimum";
    case "above-max":
      return "Above Maximum";
    case "below-max":
      return "Below Maximum";
    default:
      return v;
  }
}

/** Pretty short label for a `Timing` value — drives the scope strip's
    summary string and the entry surface's draft preview when timing
    narrows the dataset. Vocabulary is the listing-approved "Overdue"
    and "Due" terms — no new labels invented here. */
export function timingLabel(t: Timing, horizonDays: number): string {
  switch (t) {
    case "overdue":
      return "Overdue";
    case "due":
      return horizonDays >= ALL_TIME_HORIZON ? "Due any time" : `Due in next ${horizonDays} days`;
    case "all":
    default:
      return "All";
  }
}

/** Short, human-readable strings describing what's set on the active
    parameter set. Powers the post-apply summary strip at the top of
    the All Demand card. */
export function paramsSummary(p: ProcurementPlanningParams): string[] {
  const parts: string[] = [];
  parts.push(
    p.customEnd
      ? "Custom window"
      : p.horizonDays >= ALL_TIME_HORIZON
        ? "All time"
        : `Next ${p.horizonDays} days`,
  );
  if (p.mineOnly) parts.push("My items only");
  parts.push(
    p.sources.length === 0
      ? "All sources"
      : `Sources: ${p.sources.join(", ")}`,
  );
  if (p.categories.length > 0) {
    parts.push(
      p.categories.length === 1
        ? p.categories[0]
        : `${p.categories.length} categories`,
    );
  }
  if (p.items.length > 0) {
    parts.push(p.items.length === 1 ? "1 item" : `${p.items.length} items`);
  }
  if (p.purchasingOwners.length > 0) {
    parts.push(
      p.purchasingOwners.length === 1
        ? p.purchasingOwners[0]
        : `${p.purchasingOwners.length} owners`,
    );
  }
  if (p.acquisitionMethods.length > 0) {
    parts.push(p.acquisitionMethods.join(", "));
  }
  if (p.bands.length > 0) {
    parts.push(p.bands.map(bandLabel).join(", "));
  }
  if (p.timing !== "all") {
    parts.push(timingLabel(p.timing, p.horizonDays));
  }
  return parts;
}

/** Equality check — drives "Save" / "Restore" enablement and matches
    a draft against any saved view to highlight the active preset. */
export function paramsEqual(
  a: ProcurementPlanningParams,
  b: ProcurementPlanningParams,
): boolean {
  if (a.horizonDays !== b.horizonDays) return false;
  if (a.timing !== b.timing) return false;
  if (a.mineOnly !== b.mineOnly) return false;
  if ((a.customStart || "") !== (b.customStart || "")) return false;
  if ((a.customEnd || "") !== (b.customEnd || "")) return false;
  if (!!a.includeItemsWithoutIssues !== !!b.includeItemsWithoutIssues) return false;
  /* Overstock threshold — either both null or same mode+value. */
  const ao = a.overstockThreshold ?? null;
  const bo = b.overstockThreshold ?? null;
  if (ao === null || bo === null) {
    if (ao !== bo) return false;
  } else if (ao.mode !== bo.mode || ao.value !== bo.value) {
    return false;
  }
  const sameSet = <T,>(x: T[], y: T[]) =>
    x.length === y.length && x.every((v) => y.includes(v));
  return (
    sameSet(a.sources, b.sources) &&
    sameSet(a.categories, b.categories) &&
    sameSet(a.items, b.items) &&
    sameSet(a.bands, b.bands) &&
    sameSet(a.purchasingOwners, b.purchasingOwners) &&
    sameSet(a.acquisitionMethods, b.acquisitionMethods)
  );
}
