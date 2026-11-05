/**
 * categoryReconcile — data + pure logic behind the "Change Primary Category"
 * reconciliation step (fires when an existing item's primary category changes
 * in Edit Item, before leaving the Category screen).
 *
 * The governing rule: the category change ALWAYS succeeds. Nothing here ever
 * blocks the re-categorization. This logic only decides which of the new
 * category's CONFIGURATION DEFAULTS get pushed onto the item when the user
 * chooses to push.
 *
 * Scope (per design decision): four category-driven configurations —
 *   Tier 1 — Base UOM
 *   Tier 2 — Control Type, Lot Tracking
 *   Tier 3 — Valuation Method
 *
 * Push rules (assuming the user chose "Push") — gated by a SINGLE
 * has-any-transaction check (history OR open transactions):
 *   • No transactions  → every differing configuration is pushed.
 *   • Has transactions →
 *       Tier 1            : never pushed.
 *       Tier 2 (upstream) : pushed ONLY when the change TIGHTENS control —
 *                           Control Type Non-serialized → Serialized,
 *                           Lot Tracking Off → On. The loosening direction is
 *                           not pushed.
 *       Tier 3            : always pushed.
 *
 * Every configuration is returned (not just the differing ones) annotated with
 * a status — pushed | held | unchanged — so the review can show the full table.
 *
 * Open-transaction state reuses the SAME source as the archive gate
 * (getItemActiveTransactions) so the two surfaces never disagree.
 */
import type { Item } from "@/app/context/ItemsContext";
import { getItemActiveTransactions } from "./ItemLifecycleModal";

export type ControlType = "Serialized" | "Non-serialized";
export type ValuationMethod = "fifo" | "wac" | "lifo" | "specific";

/** The config defaults a category sets for items configured from it. */
export interface CategoryConfigDefaults {
  baseUom: string;
  controlType: ControlType;
  lotTracking: boolean;
  valuationMethod: ValuationMethod;
}

/* Per-category config defaults, keyed by CATEGORIES id (cat-1 = Electronics,
   cat-2 = Hardware, cat-3 = Mechanical, cat-4 = Motors, cat-5 = Pneumatics …).
   Sparse on purpose — categories without an entry fall through to
   FALLBACK_DEFAULTS. Values are intentionally varied so a category change
   surfaces real diffs to reconcile. */
const CATEGORY_CONFIG_DEFAULTS: Record<string, CategoryConfigDefaults> = {
  "cat-1": { baseUom: "ea", controlType: "Serialized", lotTracking: true, valuationMethod: "fifo" }, // Electronics
  "cat-2": { baseUom: "box", controlType: "Non-serialized", lotTracking: false, valuationMethod: "wac" }, // Hardware
  "cat-3": { baseUom: "ea", controlType: "Non-serialized", lotTracking: false, valuationMethod: "fifo" }, // Mechanical
  "cat-4": { baseUom: "box", controlType: "Serialized", lotTracking: false, valuationMethod: "wac" }, // Motors
  "cat-5": { baseUom: "kg", controlType: "Serialized", lotTracking: false, valuationMethod: "lifo" }, // Pneumatics
};

const FALLBACK_DEFAULTS: CategoryConfigDefaults = {
  baseUom: "ea",
  controlType: "Non-serialized",
  lotTracking: false,
  valuationMethod: "wac",
};

/** Resolve a category's config defaults; unknown / null categories fall back. */
export function getCategoryConfigDefaults(
  categoryId: string | null | undefined,
): CategoryConfigDefaults {
  if (categoryId && CATEGORY_CONFIG_DEFAULTS[categoryId]) {
    return CATEGORY_CONFIG_DEFAULTS[categoryId];
  }
  return FALLBACK_DEFAULTS;
}

/* ── Display helpers ─────────────────────────────────────────────────────── */
const VALUATION_LABEL: Record<ValuationMethod, string> = {
  fifo: "FIFO",
  wac: "Weighted Avg",
  lifo: "LIFO",
  specific: "Specific ID",
};

const fmtUom = (v: string) => v || "—";
const fmtControl = (v: ControlType) => v;
const fmtLot = (v: boolean) => (v ? "On" : "Off");
const fmtValuation = (v: ValuationMethod) => VALUATION_LABEL[v] ?? v;

/** Normalize the Item's "Serialized" | "Non-Serialized" to the config vocab. */
function normalizeControl(v: string | undefined): ControlType {
  return (v ?? "").toLowerCase() === "serialized" ? "Serialized" : "Non-serialized";
}

/* ── Reconciliation model ────────────────────────────────────────────────── */
export type ReconcileFieldKey = "uom" | "controlType" | "lotControlEnabled" | "valuationMethod";
export type ReconcileTier = 1 | 2 | 3;
/** pushed = differs and applied; held = differs but blocked by transactions;
 *  unchanged = identical in both the item and the destination category. */
export type ReconcileStatus = "pushed" | "held" | "unchanged";

export interface ConfigRow {
  key: ReconcileFieldKey;
  label: string;
  tier: ReconcileTier;
  /** Human-readable current value (what the item keeps if not pushed). */
  currentDisplay: string;
  /** Human-readable default from the destination category. */
  newDisplay: string;
  /** Raw value written into the working config when this row is pushed. */
  newValue: string | boolean;
  status: ReconcileStatus;
}

/** The slice of the persisted Item this logic reads. */
export type ReconcileItem = Pick<
  Item,
  "id" | "unit" | "inventoryControlType" | "lotControl" | "valuationMethod" | "hasTransactionHistory"
>;

/** Single "has any transaction" gate — history OR an open transaction. */
export function itemHasTransactions(item: ReconcileItem): boolean {
  const open = item?.id ? getItemActiveTransactions(item.id).total : 0;
  return !!item?.hasTransactionHistory || open > 0;
}

/**
 * Return ALL four configurations (not just the differing ones), each annotated
 * with its tier + status. The review renders the full table; the caller applies
 * only the rows whose status is "pushed".
 */
export function computeCategoryConfigRows(
  item: ReconcileItem,
  newCategoryId: string | null | undefined,
): ConfigRow[] {
  const d = getCategoryConfigDefaults(newCategoryId);
  const hasTx = itemHasTransactions(item);

  const classify = (differs: boolean, pushable: boolean): ReconcileStatus =>
    !differs ? "unchanged" : pushable ? "pushed" : "held";

  const rows: ConfigRow[] = [];

  // Tier 1 — Base UOM. Never pushes once the item has transactions.
  {
    const cur = item.unit ?? "";
    const differs = cur !== d.baseUom;
    rows.push({
      key: "uom", label: "Base UOM", tier: 1,
      currentDisplay: fmtUom(cur), newDisplay: fmtUom(d.baseUom), newValue: d.baseUom,
      status: classify(differs, !hasTx),
    });
  }

  // Tier 2 — Control Type. With transactions, push only when TIGHTENING control
  // (Non-serialized → Serialized).
  {
    const cur = normalizeControl(item.inventoryControlType);
    const differs = cur !== d.controlType;
    const tightening = cur === "Non-serialized" && d.controlType === "Serialized";
    rows.push({
      key: "controlType", label: "Control Type", tier: 2,
      currentDisplay: fmtControl(cur), newDisplay: fmtControl(d.controlType), newValue: d.controlType,
      status: classify(differs, !hasTx || tightening),
    });
  }

  // Tier 2 — Lot Tracking. With transactions, push only when TIGHTENING control
  // (Off → On).
  {
    const cur = !!item.lotControl;
    const differs = cur !== d.lotTracking;
    const tightening = cur === false && d.lotTracking === true;
    rows.push({
      key: "lotControlEnabled", label: "Lot Tracking", tier: 2,
      currentDisplay: fmtLot(cur), newDisplay: fmtLot(d.lotTracking), newValue: d.lotTracking,
      status: classify(differs, !hasTx || tightening),
    });
  }

  // Tier 3 — Valuation Method. Always pushes.
  {
    const cur = (item.valuationMethod ?? "fifo") as ValuationMethod;
    const differs = cur !== d.valuationMethod;
    rows.push({
      key: "valuationMethod", label: "Valuation Method", tier: 3,
      currentDisplay: fmtValuation(cur), newDisplay: fmtValuation(d.valuationMethod), newValue: d.valuationMethod,
      status: classify(differs, true),
    });
  }

  return rows;
}
