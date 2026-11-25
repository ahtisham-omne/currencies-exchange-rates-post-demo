import * as React from "react";
import { FONT } from "../designTokens";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isBaseCurrency } from "@/app/currency/currencies";
import { CurrencyPill } from "./CurrencyChip";
import type { DocView } from "./docCurrencyContext";

/* ── The PO header's currency controls ─────────────────────────────────
 * Currency Touchpoints Map, Purchase Orders 4: "PO-000002 · Toyota Technical
 * Center [USD]". The vendor's name and the PO's currency tag (only on a PO in
 * a foreign currency; a PKR PO gets none). The configuration opens from the
 * Order Summary's currency card.
 *
 * POCurrencyViewSwitch (25 Nov 2026, detail-page currency switch): the
 * Base Currency | Vendor Currency switch. Not in the document header (user,
 * 25 Nov): it sits on the Line Items card's toolbar row, beside Add Items.
 * It flips every amount on the PO page between the base currency and the
 * PO's; a read-only view, kept per PO for the session (poView.ts). */

export function POCurrencyHeaderControls({
  vendorName,
  currency,
  compact,
  view = "base",
  onOpenConfig: _onOpenConfig,
}: {
  vendorName: string;
  /** The PO's currency (the vendor's, unless changed on the PO). */
  currency: string;
  /** The header's scrolled (compact) state. */
  compact?: boolean;
  /** Which currency the page shows amounts in, for the tag's note. */
  view?: DocView;
  onOpenConfig: () => void;
}) {
  const foreign = !isBaseCurrency(currency);
  const note =
    view === "document"
      ? "This PO's currency. Amounts show in it; hover one for the base currency."
      : "This PO's currency. Amounts show in the base currency; hover one for the vendor's.";
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
      {foreign && <CurrencyPill code={currency} note={note} />}
    </div>
  );
}

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
          style={{ fontWeight: active ? 500 : 400, fontFamily: FONT }}
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

/** Base Currency | Vendor Currency. Renders nothing on a PO in the base
 *  currency: there's nothing to switch. */
export function POCurrencyViewSwitch({
  currency,
  view,
  onViewChange,
}: {
  /** The PO's currency. */
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
        label="Vendor Currency"
        tip="Show amounts in the currency set for this purchase order."
      />
    </div>
  );
}
