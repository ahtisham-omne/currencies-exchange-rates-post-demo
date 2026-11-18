import * as React from "react";
import { Info, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { BASE_CURRENCY, getCurrency } from "@/app/currency/currencies";
import type { DocView } from "./docCurrencyContext";

/* ── The SO header's currency controls ─────────────────────────────────
 * Ported from the earlier Sales Orders touchpoint (SODetail's header row),
 * in the shape Purchase Orders uses: the Base Currency | Customer Currency
 * toggle, which switches every amount on the order between the base currency
 * and the customer's, and the Currency button, which opens the order's
 * currency configuration. The toggle only shows on an order in a foreign
 * currency: on a base-currency order there's nothing to switch. */

const FONT = "Inter, system-ui, sans-serif";

function Segment({ active, onClick, label, tip, compact }: { active: boolean; onClick: () => void; label: string; tip: string; compact: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] whitespace-nowrap cursor-pointer transition-colors ${compact ? "h-6" : "h-7"} ${
        active ? "bg-[#EDF4FF] text-primary" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
      style={{ fontWeight: active ? 600 : 500, fontFamily: FONT }}
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

export function SOCurrencyHeaderControls({
  currency,
  view,
  onViewChange,
  onOpenConfig,
  compact = false,
}: {
  /** The order's currency (the customer's, unless changed on the order). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  onOpenConfig: () => void;
  /** The scrolled (compact) header. */
  compact?: boolean;
}) {
  const foreign = currency.toUpperCase() !== BASE_CURRENCY;
  const baseName = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {foreign && (
        <div
          className={`inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-white shadow-sm ${compact ? "h-8" : "h-9"}`}
          role="group"
          aria-label="Show amounts in"
        >
          <Segment
            compact={compact}
            active={view === "base"}
            onClick={() => onViewChange("base")}
            label="Base Currency"
            tip={`Show every amount in the company's base currency, ${baseName} (${BASE_CURRENCY}), so orders compare whatever currency they're in. The customer's amount is on hover.`}
          />
          <Segment
            compact={compact}
            active={view === "document"}
            onClick={() => onViewChange("document")}
            label="Customer Currency"
            tip={`Show every amount in the currency this order is placed in (${currency}), what the customer pays. The base-currency amount is on hover.`}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onOpenConfig}
        aria-label="Open currency configuration"
        className={`inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-border bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer text-[12px] ${compact ? "h-8" : "h-9"}`}
        style={{ fontWeight: 500, fontFamily: FONT }}
      >
        <Settings2 className="w-3.5 h-3.5 text-slate-500" />
        Currency
      </button>
    </div>
  );
}
