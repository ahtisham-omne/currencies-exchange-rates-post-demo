import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { customerCurrency } from "@/app/currency/soFx";
import { CurrencyPill } from "./CurrencyChip";
import type { DocView } from "./docCurrencyContext";

/* ── The SO header's currency ──────────────────────────────────────────
 * Currency Touchpoints Map (24 Nov 2026): "SO-000-112 from Q-000-750 ·
 * Harbor Point Rescue [USD]". The header carries the order's currency tag,
 * after the customer's name. Amounts show in the customer's currency by
 * default (27 Nov 2026, D1), base on hover; the Base Currency | Customer Currency switch
 * (25 Nov 2026), which sits in the Line Items toolbar, not the header,
 * flips that for the order for the session (docView.ts), never an edit.
 * The currency configuration opens from the summary's currency card. A
 * base-currency order gets neither tag nor switch. */

const FONT = "Inter, system-ui, sans-serif";

/** "from Q-000-105-001 · Harbor Point Rescue [USD]", after the state pills.
 *  The tag shows only on an order in a foreign currency. */
export function SOHeaderCustomer({
  customer,
  currency,
  sourceQuoteRef,
  view = "document",
  compact = false,
}: {
  customer: string;
  /** The order's currency. */
  currency: string;
  /** The quote the order was made from, if any. */
  sourceQuoteRef?: string;
  /** Which currency the page shows amounts in. */
  view?: DocView;
  /** The scrolled (compact) header. */
  compact?: boolean;
}) {
  const code = currency.toUpperCase();
  const foreign = !isBaseCurrency(code);
  if (!customer && !foreign) return null;
  const name = getCurrency(code)?.name ?? code;
  const shown =
    view === "document"
      ? `Amounts show in ${code}; hover one for ${BASE_CURRENCY}.`
      : `Amounts show in ${BASE_CURRENCY}; hover one for ${code}.`;
  const note = sourceQuoteRef
    ? `The order's currency, from quote ${sourceQuoteRef}. ${shown}`
    : `The order's currency${customerCurrency(customer) === code ? `, ${customer || "the customer"}'s default` : ""}. ${shown}`;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" style={{ fontFamily: FONT }}>
      {customer && (
        <span
          className="truncate text-slate-600"
          style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 500, lineHeight: compact ? "18px" : "22px", maxWidth: 320 }}
          title={sourceQuoteRef ? `From quote ${sourceQuoteRef} · ${customer}` : customer}
        >
          {sourceQuoteRef && <span className="text-slate-400" style={{ fontWeight: 400 }}>from {sourceQuoteRef} · </span>}
          {customer}
        </span>
      )}
      {foreign && (
        <span className="shrink-0 inline-flex" aria-label={`Order currency: ${name} (${code})`}>
          <CurrencyPill code={code} note={note} />
        </span>
      )}
    </span>
  );
}

/** The Order summary's Currency row (Mahreen, 27 Nov 2026, 4b), worded as
 *  the header tag's note above: "USD, from the customer", "USD, from quote
 *  Q-000-100-001", or "EUR, changed on this order" when the order's currency
 *  isn't the customer's. */
export function currencyOriginText(currency: string, customer: string | null | undefined, sourceQuoteRef?: string | null): string {
  const code = currency.toUpperCase();
  if (sourceQuoteRef) return `${code}, from quote ${sourceQuoteRef}`;
  return customerCurrency(customer) === code ? `${code}, from the customer` : `${code}, changed on this order`;
}

/* Same segment and frame as Vendor Invoicing's CurrencyHeaderControls. */
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

/** The Base Currency | Customer Currency switch, in the Line Items
 *  toolbar (not the header). Only on an order in a foreign currency: on a
 *  base-currency order there's nothing to switch. */
export function SOCurrencyViewSwitch({
  currency,
  view,
  onViewChange,
}: {
  /** The order's currency (the customer's, unless changed on the order). */
  currency: string;
  view: DocView;
  onViewChange: (view: DocView) => void;
}) {
  if (isBaseCurrency(currency.toUpperCase())) return null;
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
        tip="Show amounts in the currency set for this sales order."
      />
    </div>
  );
}
