/* ═══════════════════════════════════════════════════════════════
   Planner transaction enrichment — UnifiedTransaction → TxRowData
   ───────────────────────────────────────────────────────────────
   The planner already builds a single chronological list of
   `UnifiedTransaction` rows (UnifiedTransactionStream's merge memo:
   real demand + real incoming + phantom demand + simulated what-ifs +
   planned vendor POs). The NEW PlannerTransactionTable renders a richer
   `TxRowData` shape (type/kind/direction, party, planned-vs-processed
   qty, a running on-hand walk with band classification + guardrail
   crossings, and per-line pricing).

   This module is the pure adapter between the two. It does NOT re-derive
   the source rows — it takes the planner's existing `UnifiedTransaction[]`
   and the projection context, then ports UnifiedTransactionStream's own
   band / crossing / movement / running-balance logic verbatim so the new
   table can never drift from the stream it replaces.

   Nothing here renders; nothing here owns state. One TxRowData out per
   UnifiedTransaction in, in ascending-date order.
   ═══════════════════════════════════════════════════════════════ */

import { TxRowData, TxBand } from "./PlannerTransactionTable";
import { sourceDocHref } from "./plannerData";

/* ─────────────────────────── INPUT SHAPE ───────────────────────────
   `UnifiedTransaction` is declared (not exported) inside
   UnifiedTransactionStream.tsx. Per the working agreement we don't touch
   that file to export it, so we mirror its fields here as a local
   structural type. Keep this in lock-step with the interface there
   (UnifiedTransactionStream.tsx ~L117-163): the merge memo populates
   exactly these. */
export interface UnifiedTransactionInput {
  id: string;
  direction: "incoming" | "outgoing";
  /** ISO yyyy-mm-dd. */
  date: string;
  daysFromToday: number;
  /** Signed: +N incoming, −N outgoing. */
  qty: number;
  /** "SO" | "Purchase Request" | "PO" | "Planned demand" | (simulated label). */
  typeLabel: string;
  /** Document reference — SO# / PR# / "PO-{n}" /
      "Planned purchase order" / phantom id / simulated reference. */
  reference: string;
  /** Planned vendor POs only: ISO date the order must be placed (arrival − lead). */
  orderDate?: string;
  /** Customer / vendor / requester. */
  partyLabel?: string;
  /** Lifecycle state — incoming POs carry "Draft" here to mark a draft PO. */
  state?: string;
  priority?: string;
  reason?: string;
  isPhantom?: boolean;
  isPredicted?: boolean;
  isSimulated?: boolean;
  isPlanned?: boolean;
  /** Sandbox adjustment on a real row ("excluded" | "flagged"). */
  adjustment?: "excluded" | "flagged";
  /** Optional processed magnitude when the source row carries it
      (SO units shipped, PO units received). The current planner memo
      does not populate these on UnifiedTransaction; supported here so
      callers that DO have them (e.g. a richer row) flow them through.
      Always a positive magnitude. */
  qtyShipped?: number;
  receivedQuantity?: number;
}

export interface EnrichContext {
  /** Opening on-hand the ledger walks from (item.onHand − quarantined). */
  startingBalance: number;
  minLevel?: number;
  maxLevel?: number;
  baseUom: string;
  /** Real vendor unit price for the planned item — seeds synthesized
      line pricing on demand/other rows that have no price of their own. */
  vendorUnitPrice?: number;
  /** poNumber → PO id resolver — lets draft-PO / PO-receipt rows become
      clickable links back to their detail page (Areeb H2). Absent for
      read-only surfaces (e.g. the item-quickview drawer). */
  poIdByNumber?: Map<string, string>;
}

/* ─────────────────────────── BAND LOGIC (ported) ───────────────────────────
   Faithful copy of UnifiedTransactionStream's StockBand machinery
   (~L336-399). Same four bands, same ranking, same thresholds, same
   crossing labels — DO NOT introduce new cutoffs here. The only adaptation
   is the band-name vocabulary: the stream's internal
   "healthy|belowMax|belowMin|belowZero" maps 1:1 onto TxBand's
   "healthy|belowMax|belowMin|belowZero" (see TxBand import). */

/* Above-max slots between belowMax and belowMin — overstock is a real
   issue (Nophil 2026-07-14) but never blocks a production line the way
   a shortage does. Rank stays a monotonic "severity" scale so the sort
   below still works; direction-of-worsening isn't monotonic anymore
   (going UP past max also worsens), so `crossingBetween` handles the
   aboveMax edges explicitly. */
const BAND_RANK: Record<TxBand, number> = {
  healthy: 0,
  belowMax: 1,
  aboveMax: 2,
  belowMin: 3,
  belowZero: 4,
};

/** Classify a running on-hand value into one of the five guardrail bands.
    Above-max ADDED 2026-07-14: values that strictly exceed the ceiling
    are now surfaced as overstock, not silently rolled into "healthy".
    When a guardrail is absent we treat it as non-binding: no min → 0,
    no max → +∞ (never trips above/below-max). */
function bandOf(value: number, minLevel?: number, maxLevel?: number): TxBand {
  const min = minLevel ?? 0;
  const max = maxLevel ?? Number.POSITIVE_INFINITY;
  if (value < 0) return "belowZero";
  if (value < min) return "belowMin";
  if (value > max) return "aboveMax";
  if (value < max) return "belowMax";
  return "healthy";
}

/** The crossing (if any) when the running balance moves from `prev` band to
    `next` band. Names the guardrail just crossed. Above-max is bidirectional
    (worsening = going UP, recovering = coming DOWN) so we branch on it
    first; other transitions stay in the shortage-direction model. */
function crossingBetween(
  prev: TxBand,
  next: TxBand,
): { label: string; tone: TxBand } | null {
  if (prev === next) return null;
  /* Overstock edges — special-cased so "worse = go UP past max" reads
     correctly even though rank is still monotonic. */
  if (next === "aboveMax") {
    return { label: "Going above maximum", tone: next };
  }
  if (prev === "aboveMax") {
    return { label: "Back below maximum", tone: next };
  }
  if (BAND_RANK[next] > BAND_RANK[prev]) {
    const label =
      next === "belowZero"
        ? "Going below zero"
        : next === "belowMin"
          ? "Going below minimum"
          : "Going below maximum";
    return { label, tone: next };
  }
  const label =
    next === "healthy"
      ? "Back above maximum"
      : next === "belowMax"
        ? "Back above minimum"
        : "Back above zero";
  return { label, tone: next };
}

/* ─────────────────────────── MOVEMENT (ported) ───────────────────────────
   A row "moves" inventory only if it's a firm demand / incoming / planned /
   simulated line. Adjusted (excluded/flagged) rows, draft SOs/POs and
   reorder-point signals flag a condition but carry the balance forward.
   Ported verbatim from UnifiedTransactionStream `isMovement` (~L326). */
function isMovementRow(t: UnifiedTransactionInput): boolean {
  return !t.adjustment && t.state !== "Draft" && t.typeLabel !== "Low Stock";
}

/* ─────────────────────────── TYPE MAPPING ───────────────────────────
   Map a UnifiedTransaction onto the table's (typeKind, typeLabel). The
   planner memo distinguishes a firm incoming PO from a draft one by
   `state === "Draft"` on a "PO"-typeLabel row (mirrors PlannerGapGraph's
   dot taxonomy / UnifiedTransactionStream `graphDotFor` ~L196). Flags take
   precedence over the raw label: a planned/simulated/phantom row is tagged
   as such regardless of the label it was built with. */

export type TxTypeKind =
  | "so"
  | "pr"
  | "po"
  | "draft"
  | "planned"
  | "demand"
  | "simulated";

function mapType(t: UnifiedTransactionInput): {
  typeKind: TxTypeKind;
  typeLabel: string;
} {
  // Flag-driven kinds first — these override the underlying typeLabel.
  if (t.isPlanned) return { typeKind: "planned", typeLabel: "Planned PO" };
  if (t.isSimulated)
    return {
      typeKind: "simulated",
      typeLabel: t.direction === "incoming" ? "Simulated supply" : "Simulated demand",
    };
  // Phantom = injected forecast demand (rendered "Planned demand" in the stream).
  if (t.isPhantom) return { typeKind: "demand", typeLabel: "Planned demand" };

  switch (t.typeLabel) {
    case "SO":
      return { typeKind: "so", typeLabel: "Sales order" };
    case "Purchase Request":
      return { typeKind: "pr", typeLabel: "Purchase request" };
    case "PO":
      // Firm incoming PO -> "Purchase order" (Eli 2026-07-09: spell it
      // out to match Sales order; also, this is a FUTURE projection so
      // "PO Receipt" / "Receiving" is wrong — nothing has been received
      // yet). Draft POs get their own label via state === "Draft".
      return t.state === "Draft"
        ? { typeKind: "draft", typeLabel: "Draft purchase order" }
        : { typeKind: "po", typeLabel: "Purchase order" };
    case "Planned demand":
      return { typeKind: "demand", typeLabel: "Planned demand" };
    default:
      // Unmapped forecast/other demand-style lines fall back to planned demand.
      return { typeKind: "demand", typeLabel: t.typeLabel || "Planned demand" };
  }
}

/* ─────────────────────────── SOURCE REF / HREF ───────────────────────────
   The reference shown in the Source column, plus a routable href when one
   exists. Only SO + Purchase Request references link (sourceDocHref is the
   single source of truth for those routes); POs are not routable in this
   surface, so their href is null (no PO-detail route exists — confirmed
   against the stream). Synthetic references ("Planned purchase order",
   phantom ids, simulated refs) are plain text. */
function mapSource(
  t: UnifiedTransactionInput,
  typeKind: TxTypeKind,
  poIdByNumber?: Map<string, string>,
): { sourceRef: string; sourceHref: string | null } {
  const ref = t.reference;
  if (typeKind === "so") return { sourceRef: ref, sourceHref: sourceDocHref("SO", ref) };
  if (typeKind === "pr") return { sourceRef: ref, sourceHref: sourceDocHref("Request", ref) };
  // Draft POs + real PO receipts — resolve poNumber → PO id so the ref
  // becomes a clickable link to that PO's detail page. When we don't
  // have an internal id (e.g. seeded incoming POs missing from the
  // store) fall back to linking by the PO number itself (buyer
  // feedback 2026-07-16: "draft PO items should be clickable through
  // to the PO"). The PO detail route accepts either shape.
  if (typeKind === "draft" || typeKind === "po") {
    const poId = poIdByNumber?.get(ref);
    return { sourceRef: ref, sourceHref: `/purchase-orders/${poId ?? ref}` };
  }
  // Planned / simulated / demand — synthetic refs, no route.
  return { sourceRef: ref, sourceHref: null };
}

/* ─────────────────────────── SYNTHETIC TIME ───────────────────────────
   The source rows carry only a date (no time). The table shows a "HH:mm".
   Synthesize one DETERMINISTICALLY from the row id so it's stable across
   renders (never Math.random), spread across business hours 08:00–17:00. */
function synthTime(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // 9 business hours * 60 = 540 minute slots starting at 08:00.
  const minutesIntoDay = 8 * 60 + (h % 540);
  const hh = Math.floor(minutesIntoDay / 60);
  const mm = minutesIntoDay % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ─────────────────────────── PRICING ───────────────────────────
   PO-style rows would carry a real unit price / line total upstream; the
   current UnifiedTransaction does not surface those, so the only real price
   we have access to is the item's vendor unit price (ctx.vendorUnitPrice).
   We use it for every priced row and synthesize a small deterministic
   fallback per-row when it's absent, so the column is never empty for a
   row that has a quantity. linePrice = unitPrice * plannedQty. Returns
   nulls only when there's genuinely no quantity to price. */
const FALLBACK_UNIT_PRICE_MIN = 5; // small, deterministic, non-zero
function synthUnitPrice(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // $5–$54, stable per row.
  return FALLBACK_UNIT_PRICE_MIN + (h % 50);
}

/* ─────────────────────────── DISPLAY ID ───────────────────────────
   Raw row ids are long internal strings ("PO-3750", forecast
   keys, etc.). The Transaction ID column shows a short, uniform ledger id
   in the shape "TX-2025-4561": TX-<year>-<4 digits>. Year comes from the
   row's date; the 4-digit serial is a DETERMINISTIC hash of the raw id so
   the same transaction keeps the same number across re-renders and toggles
   (never Math.random). The raw id stays the React key / sort tiebreak, so
   a serial collision is cosmetic only. */
function synthTxId(id: string, date: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const year = /^\d{4}/.test(date) ? date.slice(0, 4) : "2025";
  const serial = String(1000 + (h % 9000)); // 1000–9999, always 4 digits
  return `TX-${year}-${serial}`;
}

/* ─────────────────────────── PUBLIC API ─────────────────────────── */

/**
 * Map the planner's existing `UnifiedTransaction` rows into the shared
 * `TxRowData` shape consumed by PlannerTransactionTable.
 *
 * Output is one row per input row, in ascending-date (chronological) order —
 * the same order the stream's merge memo produces (`a.date.localeCompare(b.date)`).
 * The running on-hand walk, band classification and guardrail-crossing
 * annotations are computed over that chronological order from
 * `ctx.startingBalance`, porting UnifiedTransactionStream's `balanceById` /
 * `crossingById` / `bandOf` / `isMovement` logic exactly.
 */
export function enrichTransactions(
  txns: UnifiedTransactionInput[],
  ctx: EnrichContext,
): TxRowData[] {
  // Chronological order — don't assume the caller pre-sorted (matches the
  // stream's own sort). Stable by id for same-date rows so the running walk
  // and synthesized times are deterministic.
  const sorted = [...txns].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  const rows: TxRowData[] = [];
  let bal = ctx.startingBalance;
  let prevBand = bandOf(ctx.startingBalance, ctx.minLevel, ctx.maxLevel);

  for (const t of sorted) {
    const moving = isMovementRow(t);
    const onHandBefore = bal;
    if (moving) bal += t.qty; // qty is already signed (+incoming / −outgoing)
    const onHandAfter = bal;

    // Band of the running on-hand AFTER this row, and any crossing the move
    // caused vs. the previous row's band. Crossings only make sense when both
    // guardrails are known (mirrors the stream gating crossingById on
    // minLevel != null && maxLevel != null).
    const band = bandOf(onHandAfter, ctx.minLevel, ctx.maxLevel);
    let crossing: { label: string; tone: TxBand } | null = null;
    if (ctx.minLevel != null && ctx.maxLevel != null && moving) {
      crossing = crossingBetween(prevBand, band);
    }
    // Advance the band cursor for every row (non-movement rows carry the band
    // forward unchanged, exactly as onHandAfter === onHandBefore for them).
    prevBand = band;

    const { typeKind, typeLabel } = mapType(t);
    const { sourceRef, sourceHref } = mapSource(t, typeKind, ctx.poIdByNumber);

    // Planned (ordered) magnitude — always the absolute qty.
    const plannedQty = Math.abs(t.qty);

    // Processed magnitude when the source row carries it. Forecast / simulated
    // / phantom rows have nothing processed -> null.
    let processedQty: number | null = null;
    if (!t.isSimulated && !t.isPhantom && !t.isPredicted) {
      if (t.direction === "outgoing" && t.qtyShipped != null) {
        processedQty = Math.abs(t.qtyShipped);
      } else if (t.direction === "incoming" && t.receivedQuantity != null) {
        processedQty = Math.abs(t.receivedQuantity);
      }
    }

    // Pricing — real price isn't surfaced on UnifiedTransaction, so use the
    // item vendor price (fallback to a deterministic per-row value). Priced
    // whenever there's a magnitude to price.
    const unitPrice =
      plannedQty > 0
        ? ctx.vendorUnitPrice != null && ctx.vendorUnitPrice > 0
          ? ctx.vendorUnitPrice
          : synthUnitPrice(t.id)
        : null;
    const linePrice = unitPrice != null ? unitPrice * plannedQty : null;

    rows.push({
      id: t.id,
      displayId: synthTxId(t.id, t.date),
      typeLabel,
      typeKind,
      direction: t.direction,
      sourceRef,
      sourceHref,
      date: t.date,
      time: synthTime(t.id),
      daysFromToday: t.daysFromToday,
      party: t.partyLabel?.trim() ? t.partyLabel.trim() : "",
      plannedQty,
      processedQty,
      onHandBefore,
      onHandAfter,
      isMovement: moving,
      band,
      crossing,
      unitPrice,
      linePrice,
      uom: ctx.baseUom,
      isDraft: t.state === "Draft",
      isSimulated: !!t.isSimulated,
      isPlanned: !!t.isPlanned,
      isPredicted: !!t.isPredicted,
    });
  }

  return rows;
}
