import * as React from "react";
import { Settings2 } from "lucide-react";
import { FONT } from "../designTokens";
import { isBaseCurrency } from "@/app/currency/currencies";
import { CurrencyPill } from "./CurrencyChip";

/* ── The PO header's currency controls ─────────────────────────────────
 * Currency Touchpoints Map, Purchase Orders 4: "PO-000002 · Toyota Technical
 * Center [USD] [Currency]". The vendor's name, the PO's currency tag (only
 * on a PO in a foreign currency; a PKR PO gets none) and the Currency button,
 * which opens the PO's currency configuration. There is no Base | Vendor
 * toggle any more: the PO shows its amounts in the base currency, the
 * vendor's amount and the rate in each amount's hover. */

export function POCurrencyHeaderControls({
  vendorName,
  currency,
  compact,
  onOpenConfig,
}: {
  vendorName: string;
  /** The PO's currency (the vendor's, unless changed on the PO). */
  currency: string;
  /** The header's scrolled (compact) state. */
  compact?: boolean;
  onOpenConfig: () => void;
}) {
  const foreign = !isBaseCurrency(currency);
  return (
    <div className="flex items-center min-w-0" style={{ gap: compact ? 6 : 8, fontFamily: FONT }}>
      <span className="text-slate-300 shrink-0" aria-hidden style={{ fontSize: compact ? 11 : 12 }}>·</span>
      <span
        className="truncate text-slate-600"
        title={vendorName}
        style={{ fontSize: compact ? 11.5 : 13, fontWeight: 500, lineHeight: compact ? "16px" : "18px", maxWidth: 260 }}
      >
        {vendorName}
      </span>
      {foreign && <CurrencyPill code={currency} note="This PO's currency. Amounts show in the base currency; hover one for the vendor's." />}
      <button
        type="button"
        onClick={onOpenConfig}
        aria-label="Open currency configuration"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
        style={{ height: compact ? 22 : 26, padding: compact ? "0 6px" : "0 8px", fontSize: compact ? 10.5 : 11.5, fontWeight: 500 }}
      >
        <Settings2 className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Currency
      </button>
    </div>
  );
}
