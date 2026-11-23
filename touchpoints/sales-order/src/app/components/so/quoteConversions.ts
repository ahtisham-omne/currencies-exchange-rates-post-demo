import type { SalesOrder } from "./types";
import type { SOFromQuoteFields } from "./store";
import type { RateType } from "@/app/currency/rates";

/* ── Quotes converted to sales orders (Currency Touchpoints Map, Quote to
 * sales order 1–2) ─────────────────────────────────────────────────────
 * The Quotes app (touchpoints/quotes, data/quoteToSalesOrder.ts) writes each
 * conversion to this origin's localStorage under QUOTE_TO_SO_STORAGE_KEY and
 * fires QUOTE_TO_SO_EVENT in its own window; another app's window hears the
 * browser's `storage` event. The order it becomes keeps the quote's currency
 * (it can't change), the rate the rep chose (the quote's or today's) with
 * its type and date, and the pay-to account. It starts as a Draft, so its
 * rate stays unlocked until the order is confirmed. The shape below mirrors
 * the Quotes app's QuoteToSalesOrder; keep the two in step. */

export const QUOTE_TO_SO_STORAGE_KEY = "omne.quotes.convertedToSalesOrder";
export const QUOTE_TO_SO_EVENT = "omne:quote-converted-to-sales-order";

interface QuoteConversionLine {
  itemCode: string;
  itemName: string;
  qty: number;
  uom: string;
  /** Per unit, in the quote's currency. */
  unitPrice: number;
}

export interface QuoteConversion {
  soNumber: string;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  convertedAt: string;
  customerPO?: string;
  notes?: string;
  currency: string;
  rateChoice: "quote" | "today";
  exchangeRate: number;
  rateType: RateType;
  rateDate: string;
  rateEdited: boolean;
  payToAccount: string;
  settlementCurrency: string;
  /** The quote's total in its currency. */
  total: number;
  lines?: QuoteConversionLine[];
}

/** Every conversion the Quotes app recorded on this origin, oldest first. */
export function readQuoteConversions(): QuoteConversion[] {
  try {
    const raw = window.localStorage.getItem(QUOTE_TO_SO_STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? (list as QuoteConversion[]).filter((e) => !!e && typeof e.soNumber === "string" && typeof e.currency === "string")
      : [];
  } catch {
    return [];
  }
}

/** What createSO takes for one conversion: a Draft in the quote's currency. */
export function salesOrderFromQuote(e: QuoteConversion): Partial<SalesOrder> & SOFromQuoteFields {
  const today = new Date().toISOString().split("T")[0];
  return {
    soNumber: e.soNumber,
    customer: e.customerName,
    sourceQuoteRef: e.quoteNumber,
    status: "Draft",
    orderDate: today.replace(/-/g, "/"),
    description: e.notes ?? "",
    internalNotes: e.customerPO ? `Customer PO ${e.customerPO}` : "",
    currency: e.currency,
    exchangeRate: e.exchangeRate,
    rateType: e.rateType,
    rateDate: e.rateDate,
    rateEdited: e.rateEdited,
    rateChoice: e.rateChoice,
    payToAccount: e.payToAccount,
    settlementCurrency: e.settlementCurrency,
    total: e.total,
    lines: (e.lines ?? []).map((l, j) => ({
      id: `SOL-${e.quoteId}-${j}`,
      itemCode: l.itemCode,
      itemName: l.itemName,
      itemType: "Non-Serialized",
      warehouse: "Main Warehouse",
      orderedQty: l.qty,
      // The quote's list price, before its rules: the order applies the
      // customer's pricing rules itself (usePricingRules), so they count once.
      unitPrice: l.unitPrice,
      uom: l.uom,
      // The quote's total has no tax line, so the order adds none here.
      taxRate: 0,
    })) as SalesOrder["lines"],
  };
}
