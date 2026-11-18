import * as React from "react";
import { Info, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { BASE_CURRENCY, getCurrency } from "@/app/currency/currencies";
import type { DocView } from "./docCurrencyContext";

/* ── The quote header's currency controls ─────────────────────────────
 * Ported from the earlier Quotes touchpoint (QuoteDetails' header): the
 * Base Currency | Customer Currency toggle, which switches every amount on
 * the quote between the base currency and the customer's, and the Currency
 * button, which opens the quote's currency configuration. The toggle only
 * shows on a quote in a foreign currency: on a base-currency quote there's
 * nothing to switch. Sized to the header's buttons beside it (36px, 32px
 * once the header compresses on scroll). */

const FONT = "Inter, system-ui, sans-serif";

function Segment({ active, onClick, label, tip, compact }: { active: boolean; onClick: () => void; label: string; tip: string; compact: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] whitespace-nowrap cursor-pointer transition-colors ${
        active ? "" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
      style={{
        height: compact ? 26 : 30,
        fontWeight: active ? 600 : 500,
        fontFamily: FONT,
        ...(active ? { backgroundColor: "#EDF4FF", color: "var(--primary)" } : {}),
      }}
    >
      {label}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span role="img" aria-label={tip} onClick={(e) => e.stopPropagation()} className="inline-flex">
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-[11.5px] leading-[1.5]">
          {tip}
        </TooltipContent>
      </Tooltip>
    </button>
  );
}

export function QuoteCurrencyHeaderControls({
  currency,
  view,
  onViewChange,
  onOpenConfig,
  compact = false,
  narrow = false,
}: {
  /** The quote's currency (the customer's, unless changed on the quote). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  onOpenConfig: () => void;
  /** The header has compressed on scroll. */
  compact?: boolean;
  /** Short labels on a narrow header. */
  narrow?: boolean;
}) {
  const foreign = currency.toUpperCase() !== BASE_CURRENCY;
  const baseName = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  const height = compact ? 32 : 36;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {foreign && (
        <div
          className="inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-white shadow-sm"
          style={{ height }}
          role="group"
          aria-label="Show amounts in"
        >
          <Segment
            active={view === "base"}
            onClick={() => onViewChange("base")}
            label={narrow ? "Base" : "Base Currency"}
            compact={compact}
            tip={`Show every amount in the company's base currency, ${baseName} (${BASE_CURRENCY}), so quotes compare whatever currency they're in. The customer's amount is on hover.`}
          />
          <Segment
            active={view === "document"}
            onClick={() => onViewChange("document")}
            label={narrow ? "Customer" : "Customer Currency"}
            compact={compact}
            tip={`Show every amount in the currency this quote is in (${currency}), what the customer pays. The base-currency amount is on hover.`}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onOpenConfig}
        title="Currency settings for this quote"
        aria-label="Open currency configuration"
        className="inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer text-[11.5px]"
        style={{ height, fontWeight: 500, fontFamily: FONT }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Currency
      </button>
    </div>
  );
}
