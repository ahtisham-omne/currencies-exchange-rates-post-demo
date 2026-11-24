import * as React from "react";
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
  onOpenConfig: _onOpenConfig,
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
      {/* No Currency button here (25 Nov 2026): the configuration opens from
          the Order Summary's currency card. */}
    </div>
  );
}
