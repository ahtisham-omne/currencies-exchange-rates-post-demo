import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import type { DocView } from "./docCurrencyContext";

/* ── Print in: Base Currency | Customer Currency ───────────────────────
 * The print / download preview's currency switch (25 Nov 2026), the same
 * one Purchase Orders has: print the quote in the customer's currency (the
 * default) or in the base currency, converted at the quote's rate. Same
 * frameless pills in a white bordered frame as the currency view switchers
 * elsewhere. Only on a quote in a foreign currency: in the base currency
 * there's nothing to switch. Sending to the customer stays in their
 * currency, so the send flow doesn't carry it. */

function Segment({ active, onClick, label, tip }: { active: boolean; onClick: () => void; label: string; tip: string }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          onClick={onClick}
          className={`px-2.5 py-1 rounded-md text-[12px] whitespace-nowrap transition-colors cursor-pointer ${
            active ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"
          }`}
          style={{ fontWeight: active ? 500 : 400 }}
        >
          {label}
        </button>
      </TooltipTrigger>
      {/* Above the preview modal (z 9999). */}
      <TooltipContent side="bottom" className="max-w-[260px] text-[11.5px] leading-[1.5] z-[10000]">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function PrintCurrencySwitch({
  currency,
  view,
  onViewChange,
  partyLabel = "Customer Currency",
  documentTip = "Print amounts in the currency set for this quote.",
}: {
  /** The quote's currency. */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  partyLabel?: string;
  documentTip?: string;
}) {
  if (!currency || currency.toUpperCase() === BASE_CURRENCY) return null;
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0" role="radiogroup" aria-label="Print amounts in">
      <Segment
        active={view === "base"}
        onClick={() => onViewChange("base")}
        label="Base Currency"
        tip="Print amounts in your base currency."
      />
      <Segment
        active={view === "document"}
        onClick={() => onViewChange("document")}
        label={partyLabel}
        tip={documentTip}
      />
    </div>
  );
}
