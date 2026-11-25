import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { isBaseCurrency } from "@/app/currency/currencies";
import type { DocView } from "./docCurrencyContext";

/* ── The quote page's Base Currency | Customer Currency switch ────────
 * Not in the document header (user, 25 Nov 2026): QuoteDetails renders it
 * in the Line Items toolbar (ItemsTabTableClean's toolbarExtra), right-
 * aligned before Add Line Item. The file keeps its old name. Switches every amount on the quote between
 * the base currency and the customer's; the other one stays on hover. Only
 * on a quote in a foreign currency: on a base-currency quote there's nothing
 * to switch. A view choice kept for the session (quoteView.ts), never an
 * edit. Same visual as the other document headers (vendor-invoicing's
 * CurrencyHeaderControls). No Currency button here (25 Nov 2026): the
 * configuration opens from the summary's currency card. */

function Segment({ active, onClick, label, tip }: { active: boolean; onClick: () => void; label: string; tip: string }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          onClick={onClick}
          className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
            active ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"
          }`}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-[11.5px] leading-[1.5] z-[300]">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function QuoteCurrencyHeaderControls({
  currency,
  view,
  onViewChange,
}: {
  /** The quote's currency (the customer's, unless changed on the quote). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
}) {
  if (isBaseCurrency(currency)) return null;
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0"
      role="radiogroup"
      aria-label="Show amounts in"
    >
      <Segment
        active={view === "base"}
        onClick={() => onViewChange("base")}
        label="Base Currency"
        tip="Show amounts in your base currency."
      />
      <Segment
        active={view === "document"}
        onClick={() => onViewChange("document")}
        label="Customer Currency"
        tip="Show amounts in the currency set for this quote."
      />
    </div>
  );
}
