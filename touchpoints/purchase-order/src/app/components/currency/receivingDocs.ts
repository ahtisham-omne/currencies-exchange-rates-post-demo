import type { PurchaseOrderData } from "../poStore";
import { computePOPricing } from "../poOrderPricing";
import { localTodayIso, poFx, rateSourceLabel, roundTo } from "@/app/currency/poFx";
import { rateOn, toBase, type RateType } from "@/app/currency/rates";

/* ── A PO's receiving docs and their rates ────────────────────────────
 * Currency Touchpoints Map, Receiving 1–2: the warehouse records quantities
 * only; each receiving doc takes a rate in the background, on its own
 * receiving date, and its stock is valued in the base currency at that
 * rate. The rate type follows the PO (mid-market or corporate). A doc in
 * progress takes today's rate and is unlocked; a completed one is locked at
 * the rate on the day it completed. Nobody changes it by hand.
 *
 * The PO module keeps receiving as quantities on its lines and records, so
 * the docs are read from those:
 *  - Each goods receipt recorded on the PO ("Confirm Receipt") is one doc,
 *    completed on its day (its records share a `receivingDocId`).
 *  - Quantities received without a record (the seeded POs, Mark as Fully
 *    Received) make one doc that started on the PO's receiving start date:
 *    completed when the PO is fully received (on `receivingCompletedDate`),
 *    in progress until then.
 * A doc's value is each line's received quantity × the line's net price per
 * unit on the PO (its line total ÷ its quantity: static %, pricing rules and
 * item-level one-time discounts/premiums included), in the PO's currency;
 * its base value is that at the doc's rate. */

export interface ReceivingDocLine {
  lineItemId: string;
  itemNumber: string;
  descriptiveName: string;
  qty: number;
  uom: string;
  /** In the PO's currency. */
  value: number;
}

export interface ReceivingDocFx {
  rate: number;
  rateType: RateType;
  rateDate: string;
  source: string;
  /** In progress: today's rate, which moves until the doc completes. */
  provisional: boolean;
  isBase: boolean;
}

export interface ReceivingDoc {
  key: string;
  /** "REC-000190" */
  number: string;
  status: "in-progress" | "completed";
  /** Completed: the day it completed. In progress: the day it started. */
  date: string;
  /** The PO's currency. */
  currency: string;
  lines: ReceivingDocLine[];
  /** Received value in the PO's currency. */
  value: number;
  fx: ReceivingDocFx;
  /** The value in the base currency, at the doc's rate. */
  baseValue: number;
}

const FULLY_RECEIVED = new Set(["Fully Received", "Fully Received with Cancellations"]);

/** A stable first doc number for a PO: the seeded "po-8" → 190, others hashed. */
function docNumberBase(poId: string): number {
  const seeded = /^po-(\d+)$/.exec(poId);
  if (seeded) return 120 + (Number(seeded[1]) - 1) * 10;
  let h = 0;
  for (let i = 0; i < poId.length; i++) h = ((h << 5) - h + poId.charCodeAt(i)) | 0;
  return 5000 + (Math.abs(h) % 4000) * 10;
}

const recNumber = (n: number) => `REC-${String(n).padStart(6, "0")}`;

/** The PO's rate type on a day: corporate when that's the PO's type and
 *  finance has one set, else mid-market. */
export function receivingRate(po: PurchaseOrderData, day: string, provisional: boolean): ReceivingDocFx {
  const fx = poFx(po);
  if (fx.isBase) {
    return { rate: 1, rateType: fx.rateType, rateDate: day, source: "Base currency", provisional, isBase: true };
  }
  const quote = rateOn(fx.currency, day, fx.rateType);
  const usable = quote.rate != null ? quote : rateOn(fx.currency, day, "mid");
  return {
    rate: usable.rate ?? fx.rate,
    rateType: usable.type,
    rateDate: day,
    source: rateSourceLabel(usable.type),
    provisional,
    isBase: false,
  };
}

/** Each line's net price per unit, in the PO's currency. */
function netUnitPrices(po: PurchaseOrderData): Map<string, number> {
  const pricing = computePOPricing(po);
  const out = new Map<string, number>();
  for (const li of po.lineItems) {
    const gross = li.unitPrice * (1 - li.discount / 100) * li.quantity;
    const rules = pricing.ruleBreakdowns.get(li.id);
    const oneTime = pricing.adjustments.lineBreakdowns.get(li.id)?.net ?? 0;
    const net = gross - (rules?.discountAmount ?? 0) + (rules?.premiumAmount ?? 0) + oneTime;
    out.set(li.id, li.quantity > 0 ? net / li.quantity : 0);
  }
  return out;
}

export function poReceivingDocs(po: PurchaseOrderData): ReceivingDoc[] {
  const fx = poFx(po);
  const unit = netUnitPrices(po);
  const byId = new Map(po.lineItems.map((li) => [li.id, li]));
  const today = localTodayIso();

  const makeLines = (qtyByLine: Map<string, number>) =>
    [...qtyByLine.entries()]
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const li = byId.get(id)!;
        return {
          lineItemId: id,
          itemNumber: li.itemNumber,
          descriptiveName: li.descriptiveName,
          qty,
          uom: li.defaultUOM || "Unit",
          value: roundTo(fx.currency, qty * (unit.get(id) ?? 0)),
        };
      });

  const build = (key: string, status: ReceivingDoc["status"], date: string, lines: ReceivingDocLine[]): Omit<ReceivingDoc, "number"> => {
    const docFx = receivingRate(po, status === "completed" ? date : today, status !== "completed");
    const value = lines.reduce((s, l) => s + l.value, 0);
    return { key, status, date, currency: fx.currency, lines, value, fx: docFx, baseValue: toBase(value, docFx.rate) };
  };

  const docs: Omit<ReceivingDoc, "number">[] = [];

  // Quantities received without a record: one doc from the receiving start date.
  const recorded = new Map<string, number>();
  for (const r of po.receivingRecords ?? []) recorded.set(r.lineItemId, (recorded.get(r.lineItemId) ?? 0) + r.quantityReceived);
  const remainder = new Map<string, number>();
  for (const li of po.lineItems) {
    const rest = (li.receivedQuantity ?? 0) - (recorded.get(li.id) ?? 0);
    if (rest > 0) remainder.set(li.id, rest);
  }
  if (remainder.size > 0) {
    const started = po.receivingStartDate || po.deliveryDate || po.orderDate;
    const done = FULLY_RECEIVED.has(po.status) || (po.status === "Cancelled" && FULLY_RECEIVED.has(po.preCancellationStatus ?? ""));
    docs.push(
      done
        ? build("seed", "completed", (po.receivingCompletedDate || started).slice(0, 10), makeLines(remainder))
        : build("seed", "in-progress", started.slice(0, 10), makeLines(remainder)),
    );
  }

  // Each goods receipt recorded on the PO: completed on its day.
  const receipts = new Map<string, { date: string; qty: Map<string, number> }>();
  for (const r of po.receivingRecords ?? []) {
    const id = r.receivingDocId ?? `day-${r.receivedDate}`;
    const doc = receipts.get(id) ?? { date: r.receivedDate, qty: new Map<string, number>() };
    doc.qty.set(r.lineItemId, (doc.qty.get(r.lineItemId) ?? 0) + r.quantityReceived);
    receipts.set(id, doc);
  }
  for (const [id, doc] of receipts) docs.push(build(id, "completed", doc.date.slice(0, 10), makeLines(doc.qty)));

  const first = docNumberBase(po.id);
  return docs.filter((d) => d.lines.length > 0).map((d, i) => ({ ...d, number: recNumber(first + i) }));
}
