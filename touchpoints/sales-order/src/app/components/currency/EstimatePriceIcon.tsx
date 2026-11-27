import { Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { estimateNote } from "@/app/currency/itemPrices";

/* ── An estimated line price (Nophil review item 2, 25 Nov 2026) ──────
 * The item has no price in the order's currency, so the line took the base
 * price converted at the order's rate. A small coin next to the price says
 * so; it goes away once the price is typed by hand, and a line that took
 * the item's own price in the currency shows nothing. */
export function EstimatePriceIcon({ currency, rateDate }: { currency: string; rateDate?: string | null }) {
  const note = estimateNote(currency, rateDate);
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={note}
          className="inline-flex items-center justify-center shrink-0 cursor-help text-amber-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Coins style={{ width: 12, height: 12 }} strokeWidth={2} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[11px]">
        {note}
      </TooltipContent>
    </Tooltip>
  );
}
