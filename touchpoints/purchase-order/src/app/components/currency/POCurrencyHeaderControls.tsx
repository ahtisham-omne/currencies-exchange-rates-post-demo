import * as React from "react";
import { Info, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FONT } from "../designTokens";
import { BASE_CURRENCY, getCurrency } from "@/app/currency/currencies";
import type { DocView } from "./docCurrencyContext";

/* ── The PO header's currency controls ─────────────────────────────────
 * Ported from the earlier Purchase Orders touchpoint (POCurrencyHeaderControls):
 * the Base Currency | Vendor Currency toggle, which switches every amount on the
 * PO between the base currency and the vendor's, and the Currency button,
 * which opens the PO's currency configuration. The toggle only shows on a PO in
 * a foreign currency: on a base-currency PO there's nothing to switch. */

function Segment({ active, onClick, label, tip }: { active: boolean; onClick: () => void; label: string; tip: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] whitespace-nowrap cursor-pointer transition-colors ${
        active ? "" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
      style={{
        fontWeight: active ? 600 : 500,
        fontFamily: FONT,
        ...(active ? { backgroundColor: "hsl(var(--primary-tint))", color: "hsl(var(--primary))" } : {}),
      }}
    >
      {label}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={tip}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
          >
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

export function POCurrencyHeaderControls({
  currency,
  view,
  onViewChange,
  onOpenConfig,
}: {
  /** The PO's currency (the vendor's, unless changed on the PO). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
  onOpenConfig: () => void;
}) {
  const foreign = currency.toUpperCase() !== BASE_CURRENCY;
  const baseName = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {foreign && (
        <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm" role="group" aria-label="Show amounts in">
          <Segment
            active={view === "base"}
            onClick={() => onViewChange("base")}
            label="Base Currency"
            tip={`Show every amount in the company's base currency, ${baseName} (${BASE_CURRENCY}), so POs compare whatever currency they're in. The vendor's amount is on hover.`}
          />
          <Segment
            active={view === "document"}
            onClick={() => onViewChange("document")}
            label="Vendor Currency"
            tip={`Show every amount in the currency this PO is placed in (${currency}), what the vendor receives. The base-currency amount is on hover.`}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onOpenConfig}
        aria-label="Open currency configuration"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer text-[11.5px]"
        style={{ fontWeight: 500, fontFamily: FONT }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Currency
      </button>
    </div>
  );
}
