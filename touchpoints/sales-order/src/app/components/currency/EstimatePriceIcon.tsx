import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { estimateNote } from "@/app/currency/itemPrices";
import type { RateType } from "@/app/currency/rates";

/* ── Where a line's price came from (Mahreen, 27 Nov 2026, 4d) ────────
 * Waiting on Eli; built as the proposal for Monday. A line takes the item's
 * price in the order's currency ("Item's USD price" under it), or, when the
 * item has none, its base price converted at the order's rate: an "Est."
 * chip before the price and an info icon after it, whose hover says what
 * it was converted from and at which rate. It replaces the 25 Nov amber
 * coin. A price typed by hand shows neither. */

/** "Est." before an estimated price: amber, as the app marks a figure that
 *  is indicative only (FxInset's amber tone). */
export function EstimateChip() {
  return (
    <span
      className="inline-flex items-center shrink-0 rounded px-1 text-[10px] leading-[16px] whitespace-nowrap"
      style={{ color: "#B45309", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontWeight: 600 }}
    >
      Est.
    </span>
  );
}

/** "Item's USD price": a small muted caption under a price the item sets
 *  for the order's currency. */
export function itemPriceCaption(currency: string): string {
  return `Item's ${currency.toUpperCase()} price`;
}

/** The info icon after an estimated price. Hover: "This item has no USD
 *  price. Converted from the base price ₨100.00 at today's daily market
 *  rate (1 USD = ₨278.5200)." */
export function EstimatePriceIcon({
  currency,
  basePrice,
  rate,
  rateType = "mid",
  date,
}: {
  /** The order's currency. */
  currency: string;
  /** The base price the line's price was converted from, for the line's unit. */
  basePrice: number;
  /** The order's rate: base per one unit of `currency`. */
  rate: number;
  rateType?: RateType;
  /** The order's rate date (ISO); today when left out. */
  date?: string | null;
}) {
  const note = estimateNote({ currency, basePrice, rate, rateType, date });
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={note}
          className="inline-flex items-center justify-center shrink-0 cursor-help text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-sm transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Info style={{ width: 12, height: 12 }} strokeWidth={2} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[11px]">
        {note}
      </TooltipContent>
    </Tooltip>
  );
}
